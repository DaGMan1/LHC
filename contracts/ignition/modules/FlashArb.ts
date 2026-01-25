import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Base Mainnet Addresses
const BASE_MAINNET = {
    AAVE_POOL_ADDRESSES_PROVIDER: "0xe20fCBDBfFC4Dd138CE8b65639900B6e1Fa9f5F8",
    UNISWAP_V3_SWAP_ROUTER: "0x2626664c2603336E57B271c5C0b26F421741e481",
};

const FlashArbModule = buildModule("FlashArbModule", (m) => {
    // Parameters can be overridden at deployment time
    const addressProvider = m.getParameter(
        "addressProvider",
        BASE_MAINNET.AAVE_POOL_ADDRESSES_PROVIDER
    );
    const swapRouter = m.getParameter(
        "swapRouter",
        BASE_MAINNET.UNISWAP_V3_SWAP_ROUTER
    );

    const flashArb = m.contract("FlashArb", [addressProvider, swapRouter]);

    return { flashArb };
});

export default FlashArbModule;
