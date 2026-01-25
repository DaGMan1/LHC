import hre from "hardhat";
import { formatEther } from "viem";

// Base Mainnet Protocol Addresses
const BASE_ADDRESSES = {
    AAVE_POOL_ADDRESSES_PROVIDER: "0xe20fCBDBfFC4Dd138CE8b65639900B6e1Fa9f5F8",
    UNISWAP_V3_SWAP_ROUTER: "0x2626664c2603336E57B271c5C0b26F421741e481",
};

async function main() {
    const network = hre.network.name;
    console.log(`\n========================================`);
    console.log(`Deploying FlashArb to ${network}...`);
    console.log(`========================================\n`);

    // Get deployer info
    const [deployer] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const deployerAddress = deployer.account.address;
    const balance = await publicClient.getBalance({ address: deployerAddress });

    console.log(`Deployer: ${deployerAddress}`);
    console.log(`Balance: ${formatEther(balance)} ETH\n`);

    if (balance === 0n) {
        throw new Error("Deployer has no ETH for gas fees!");
    }

    // Deploy FlashArb
    console.log("Deploying FlashArb contract...");

    const flashArb = await hre.viem.deployContract("FlashArb", [
        BASE_ADDRESSES.AAVE_POOL_ADDRESSES_PROVIDER,
        BASE_ADDRESSES.UNISWAP_V3_SWAP_ROUTER,
    ]);

    console.log(`\n========================================`);
    console.log(`FlashArb deployed successfully!`);
    console.log(`========================================`);
    console.log(`Contract Address: ${flashArb.address}`);
    console.log(`Owner: ${await flashArb.read.OWNER()}`);
    console.log(`Aave Pool: ${await flashArb.read.POOL()}`);
    console.log(`Swap Router: ${await flashArb.read.SWAP_ROUTER()}`);
    console.log(`Paused: ${await flashArb.read.paused()}`);
    console.log(`========================================\n`);

    // Verify on Basescan if not local network
    if (network !== "hardhat" && network !== "localhost") {
        console.log("Waiting 30 seconds for block confirmations...");
        await new Promise((resolve) => setTimeout(resolve, 30000));

        console.log("Verifying contract on Basescan...");
        try {
            await hre.run("verify:verify", {
                address: flashArb.address,
                constructorArguments: [
                    BASE_ADDRESSES.AAVE_POOL_ADDRESSES_PROVIDER,
                    BASE_ADDRESSES.UNISWAP_V3_SWAP_ROUTER,
                ],
            });
            console.log("Contract verified successfully!");
        } catch (error: any) {
            if (error.message.includes("Already Verified")) {
                console.log("Contract already verified!");
            } else {
                console.error("Verification failed:", error.message);
                console.log("\nYou can manually verify later with:");
                console.log(`npx hardhat verify --network ${network} ${flashArb.address} ${BASE_ADDRESSES.AAVE_POOL_ADDRESSES_PROVIDER} ${BASE_ADDRESSES.UNISWAP_V3_SWAP_ROUTER}`);
            }
        }
    }

    // Output for .env
    console.log(`\n========================================`);
    console.log(`Add to your .env file:`);
    console.log(`========================================`);
    console.log(`FLASH_ARB_CONTRACT_ADDRESS=${flashArb.address}`);
    console.log(`========================================\n`);

    return flashArb.address;
}

main()
    .then((address) => {
        console.log(`Deployment complete!`);
        process.exit(0);
    })
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
