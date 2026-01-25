// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IFlashLoanSimpleReceiver} from "@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanSimpleReceiver.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut);
}

/**
 * @title FlashArb
 * @notice Flash loan arbitrage contract for Aave V3 + Uniswap V3
 * @dev Borrows assets via flash loan, executes two-leg swap, repays with profit
 */
contract FlashArb is IFlashLoanSimpleReceiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // IMMUTABLE STATE
    // ============================================

    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
    IPool public immutable POOL;
    address public immutable OWNER;
    ISwapRouter public immutable SWAP_ROUTER;

    // ============================================
    // MUTABLE STATE
    // ============================================

    /// @notice Emergency pause flag
    bool public paused;

    /// @notice Addresses authorized to trigger flash loans (but NOT withdraw)
    mapping(address => bool) public executors;

    // ============================================
    // EVENTS
    // ============================================

    /// @notice Emitted when an arbitrage is successfully executed
    event ArbitrageExecuted(
        address indexed asset,
        uint256 flashAmount,
        uint256 profit,
        uint256 timestamp
    );

    /// @notice Emitted when emergency pause state changes
    event EmergencyPause(bool paused);

    /// @notice Emitted when tokens are withdrawn
    event Withdrawal(address indexed token, uint256 amount);

    /// @notice Emitted when executor status changes
    event ExecutorUpdated(address indexed executor, bool allowed);

    // ============================================
    // CONSTRUCTOR
    // ============================================

    /**
     * @param _addressProvider Aave PoolAddressesProvider address
     * @param _swapRouter Uniswap V3 SwapRouter address
     */
    constructor(address _addressProvider, address _swapRouter) {
        require(_addressProvider != address(0), "Invalid address provider");
        require(_swapRouter != address(0), "Invalid swap router");

        ADDRESSES_PROVIDER = IPoolAddressesProvider(_addressProvider);
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
        SWAP_ROUTER = ISwapRouter(_swapRouter);
        OWNER = msg.sender;
    }

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyOwner() {
        require(msg.sender == OWNER, "Not owner");
        _;
    }

    modifier onlyExecutor() {
        require(executors[msg.sender] || msg.sender == OWNER, "Not executor");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    // ============================================
    // FLASH LOAN CALLBACK
    // ============================================

    /**
     * @notice Callback function called by Aave after flash loan is provided
     * @dev This is where the arbitrage logic executes
     * @param asset The borrowed token address
     * @param amount The borrowed amount
     * @param premium The flash loan fee to pay back
     * @param initiator The address that initiated the flash loan
     * @param params Encoded parameters: (tokenOut, poolFee, minAmountOut)
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // SECURITY: Verify caller is the Aave pool
        require(msg.sender == address(POOL), "Caller must be pool");
        // SECURITY: Verify we initiated this flash loan
        require(initiator == address(this), "Initiator must be self");

        // Decode swap parameters
        (address tokenOut, uint24 poolFee, uint256 minAmountOut) = abi.decode(
            params,
            (address, uint24, uint256)
        );

        // 1. First swap: asset -> tokenOut
        IERC20(asset).safeIncreaseAllowance(address(SWAP_ROUTER), amount);

        uint256 amountInter = SWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: asset,
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amount,
                amountOutMinimum: 0, // We verify final amount instead
                sqrtPriceLimitX96: 0
            })
        );

        // 2. Second swap: tokenOut -> asset (closing the arb)
        IERC20(tokenOut).safeIncreaseAllowance(address(SWAP_ROUTER), amountInter);

        uint256 amountFinal = SWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenOut,
                tokenOut: asset,
                fee: poolFee, // May use different fee tier in production
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountInter,
                amountOutMinimum: minAmountOut, // Slippage protection
                sqrtPriceLimitX96: 0
            })
        );

        // 3. Calculate repayment and verify profitability
        uint256 amountToRepay = amount + premium;
        require(amountFinal >= amountToRepay, "Arb not profitable");

        // 4. Approve repayment to Aave pool
        IERC20(asset).safeIncreaseAllowance(address(POOL), amountToRepay);

        // 5. Emit profit event for off-chain monitoring
        uint256 profit = amountFinal - amountToRepay;
        emit ArbitrageExecuted(asset, amount, profit, block.timestamp);

        return true;
    }

    // ============================================
    // OWNER FUNCTIONS
    // ============================================

    /**
     * @notice Add or remove an executor (can trigger trades but NOT withdraw)
     * @param _executor Address to update
     * @param _allowed True to allow, false to revoke
     */
    function setExecutor(address _executor, bool _allowed) external onlyOwner {
        require(_executor != address(0), "Invalid executor");
        executors[_executor] = _allowed;
        emit ExecutorUpdated(_executor, _allowed);
    }

    /**
     * @notice Check if an address is an executor
     * @param _address Address to check
     */
    function isExecutor(address _address) external view returns (bool) {
        return executors[_address] || _address == OWNER;
    }

    /**
     * @notice Request a flash loan to execute arbitrage
     * @dev Can be called by OWNER or any authorized EXECUTOR
     * @param _token Token to borrow
     * @param _amount Amount to borrow
     * @param _params Encoded params: (tokenOut, poolFee, minAmountOut)
     */
    function requestFlashLoan(
        address _token,
        uint256 _amount,
        bytes calldata _params
    ) external onlyExecutor whenNotPaused nonReentrant {
        POOL.flashLoanSimple(
            address(this),
            _token,
            _amount,
            _params,
            0 // Referral code
        );
    }

    /**
     * @notice Withdraw accumulated profits (ERC20 tokens)
     * @param _token Token address to withdraw
     */
    function withdraw(address _token) external onlyOwner nonReentrant {
        uint256 balance = IERC20(_token).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        IERC20(_token).safeTransfer(OWNER, balance);
        emit Withdrawal(_token, balance);
    }

    /**
     * @notice Withdraw ETH if any gets stuck
     */
    function withdrawETH() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH balance");
        (bool success, ) = OWNER.call{value: balance}("");
        require(success, "ETH transfer failed");
        emit Withdrawal(address(0), balance);
    }

    /**
     * @notice Emergency pause/unpause
     * @param _paused True to pause, false to unpause
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit EmergencyPause(_paused);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Get token balance held by this contract
     * @param _token Token address
     */
    function getBalance(address _token) external view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    // ============================================
    // RECEIVE ETH
    // ============================================

    receive() external payable {}
}
