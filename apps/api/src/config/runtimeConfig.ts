/**
 * Runtime configuration that can be changed dynamically via API.
 * This allows the web UI to configure the bot without editing .env files.
 */

interface RuntimeConfig {
    /** Contract address (can be set via API after deployment) */
    flashArbContractAddress: string | null;
    /** Live mode (false = dry run, true = autonomous trading) */
    liveMode: boolean;
    /** Bot wallet address (derived from private key) */
    botWalletAddress: string | null;
}

// Initialize from environment variables
const config: RuntimeConfig = {
    flashArbContractAddress: process.env.FLASH_ARB_CONTRACT_ADDRESS || null,
    liveMode: process.env.DRY_RUN === 'false',
    botWalletAddress: null,
};

/**
 * Get current runtime config.
 */
export function getConfig(): Readonly<RuntimeConfig> {
    return { ...config };
}

/**
 * Set the FlashArb contract address (called after deployment from web UI).
 */
export function setContractAddress(address: string): void {
    if (!address.startsWith('0x') || address.length !== 42) {
        throw new Error('Invalid contract address format');
    }
    config.flashArbContractAddress = address;
    console.log(`[CONFIG] Contract address set: ${address}`);
}

/**
 * Set live mode (true = autonomous trading, false = dry run).
 */
export function setLiveMode(enabled: boolean): void {
    config.liveMode = enabled;
    console.log(`[CONFIG] Live mode: ${enabled ? 'ENABLED' : 'DISABLED (dry run)'}`);
}

/**
 * Set bot wallet address (for display purposes).
 */
export function setBotWalletAddress(address: string): void {
    config.botWalletAddress = address;
}

/**
 * Check if contract is configured.
 */
export function isContractConfigured(): boolean {
    return !!config.flashArbContractAddress && config.flashArbContractAddress.length === 42;
}

/**
 * Check if we're in live mode.
 */
export function isLiveMode(): boolean {
    return config.liveMode;
}

/**
 * Get contract address.
 */
export function getContractAddress(): string | null {
    return config.flashArbContractAddress;
}
