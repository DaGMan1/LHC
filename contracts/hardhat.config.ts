import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.27",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        hardhat: {
            chainId: 31337,
            forking: {
                url: BASE_RPC_URL,
                // Uncomment to pin to a specific block for deterministic testing
                // blockNumber: 20000000,
            },
        },
        base: {
            url: BASE_RPC_URL,
            chainId: 8453,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
            // Base has very low gas prices (~0.01 gwei), let it auto-estimate
        },
        baseSepolia: {
            url: "https://sepolia.base.org",
            chainId: 84532,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
            gasPrice: 1000000, // 0.001 gwei
        },
    },
    etherscan: {
        apiKey: {
            base: process.env.BASESCAN_API_KEY || "",
            baseSepolia: process.env.BASESCAN_API_KEY || "",
        },
        customChains: [
            {
                network: "base",
                chainId: 8453,
                urls: {
                    apiURL: "https://api.basescan.org/api",
                    browserURL: "https://basescan.org",
                },
            },
            {
                network: "baseSepolia",
                chainId: 84532,
                urls: {
                    apiURL: "https://api-sepolia.basescan.org/api",
                    browserURL: "https://sepolia.basescan.org",
                },
            },
        ],
    },
    tenderly: {
        username: process.env.TENDERLY_USERNAME || "",
        project: process.env.TENDERLY_PROJECT || "",
        privateVerification: true,
    },
};

export default config;
