import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const config: HardhatUserConfig = {
    solidity: "0.8.27",
    networks: {
        hardhat: {
            chainId: 31337
        }
    },
    tenderly: {
        username: process.env.TENDERLY_USERNAME || "",
        project: process.env.TENDERLY_PROJECT || "",
        privateVerification: true
    }
};

export default config;
