'use client';

import { useState, useEffect } from 'react';
import { useFlashArb } from '@/hooks/useFlashArb';
import { formatEther } from 'viem';
import { BASE_ADDRESSES } from '@/contracts/FlashArbABI';

export function DeploymentPanel() {
    const {
        contractAddress,
        isConnected,
        isDeploying,
        isPaused,
        isOwner,
        contractBalance,
        walletAddress,
        deploy,
        withdrawProfits,
        togglePause,
        setExecutor,
        checkExecutor,
        setExistingContract,
        clearContract,
    } = useFlashArb();

    const [manualAddress, setManualAddress] = useState('');
    const [executorAddress, setExecutorAddress] = useState('');
    const [isExecutorAuthorized, setIsExecutorAuthorized] = useState<boolean | null>(null);
    const [isSettingExecutor, setIsSettingExecutor] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    // Check if entered executor address is authorized
    useEffect(() => {
        if (executorAddress.length === 42 && executorAddress.startsWith('0x') && contractAddress) {
            checkExecutor(executorAddress as `0x${string}`).then(setIsExecutorAuthorized);
        } else {
            setIsExecutorAuthorized(null);
        }
    }, [executorAddress, contractAddress, checkExecutor]);

    const handleDeploy = async () => {
        setStatus({ type: 'info', message: 'Deploying contract... Please confirm in MetaMask' });
        const result = await deploy();

        if (result.success) {
            setStatus({ type: 'success', message: `Contract deployed! TX: ${result.txHash?.slice(0, 10)}...` });
        } else {
            setStatus({ type: 'error', message: result.error || 'Deployment failed' });
        }
    };

    const handleWithdraw = async () => {
        setStatus({ type: 'info', message: 'Withdrawing profits... Please confirm in MetaMask' });
        const result = await withdrawProfits(BASE_ADDRESSES.WETH);

        if (result.success) {
            setStatus({ type: 'success', message: 'Profits withdrawn!' });
        } else {
            setStatus({ type: 'error', message: result.error || 'Withdrawal failed' });
        }
    };

    const handleTogglePause = async () => {
        setStatus({ type: 'info', message: `${isPaused ? 'Unpausing' : 'Pausing'} contract...` });
        const result = await togglePause();

        if (result.success) {
            setStatus({ type: 'success', message: `Contract ${isPaused ? 'unpaused' : 'paused'}!` });
        } else {
            setStatus({ type: 'error', message: result.error || 'Failed to toggle pause' });
        }
    };

    const handleSetManual = () => {
        if (manualAddress.startsWith('0x') && manualAddress.length === 42) {
            setExistingContract(manualAddress as `0x${string}`);
            setManualAddress('');
            setStatus({ type: 'success', message: 'Contract address set!' });
        } else {
            setStatus({ type: 'error', message: 'Invalid address format' });
        }
    };

    const handleSetExecutor = async (allowed: boolean) => {
        if (!executorAddress.startsWith('0x') || executorAddress.length !== 42) {
            setStatus({ type: 'error', message: 'Invalid executor address format' });
            return;
        }

        setIsSettingExecutor(true);
        setStatus({
            type: 'info',
            message: `${allowed ? 'Authorizing' : 'Revoking'} executor... Please confirm in MetaMask`
        });

        const result = await setExecutor(executorAddress as `0x${string}`, allowed);

        if (result.success) {
            setStatus({
                type: 'success',
                message: `Executor ${allowed ? 'authorized' : 'revoked'}! TX: ${result.txHash?.slice(0, 10)}...`
            });
            setIsExecutorAuthorized(allowed);
        } else {
            setStatus({ type: 'error', message: result.error || 'Failed to set executor' });
        }

        setIsSettingExecutor(false);
    };

    if (!isConnected) {
        return (
            <div className="bg-card rounded-2xl border border-card-border p-6">
                <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4">Contract Setup</h3>
                <p className="text-zinc-500 text-xs">Connect your wallet to deploy or manage your FlashArb contract.</p>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-2xl border border-card-border p-6 space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-tight">Contract Setup</h3>

            {/* Status Message */}
            {status && (
                <div className={`text-xs p-3 rounded-lg ${status.type === 'success' ? 'bg-accent/20 text-accent' :
                        status.type === 'error' ? 'bg-red-500/20 text-red-400' :
                            'bg-primary/20 text-primary'
                    }`}>
                    {status.message}
                </div>
            )}

            {/* Wallet Info */}
            <div className="text-xs text-zinc-500">
                <span className="text-zinc-400">Wallet:</span> {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
            </div>

            {!contractAddress ? (
                /* No Contract Deployed */
                <div className="space-y-4">
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                        <p className="text-xs text-zinc-400 mb-3">
                            Deploy your FlashArb contract to start executing arbitrage trades.
                            This is a one-time deployment to Base network.
                        </p>
                        <button
                            onClick={handleDeploy}
                            disabled={isDeploying}
                            className="w-full py-3 px-4 bg-primary hover:bg-primary/80 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-widest rounded-xl transition-colors"
                        >
                            {isDeploying ? 'Deploying...' : 'Deploy FlashArb Contract'}
                        </button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-card-border"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="bg-card px-2 text-zinc-600">OR</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs text-zinc-500">Already deployed? Enter contract address:</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={manualAddress}
                                onChange={(e) => setManualAddress(e.target.value)}
                                placeholder="0x..."
                                className="flex-1 bg-zinc-900 border border-card-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary"
                            />
                            <button
                                onClick={handleSetManual}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase rounded-lg transition-colors"
                            >
                                Set
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Contract Deployed */
                <div className="space-y-4">
                    {/* Contract Info */}
                    <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500">Contract</span>
                            <a
                                href={`https://basescan.org/address/${contractAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-accent hover:underline font-mono"
                            >
                                {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                            </a>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500">Status</span>
                            <span className={`text-xs font-bold ${isPaused ? 'text-yellow-400' : 'text-accent'}`}>
                                {isPaused ? 'PAUSED' : 'ACTIVE'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500">Owner</span>
                            <span className={`text-xs font-bold ${isOwner ? 'text-accent' : 'text-red-400'}`}>
                                {isOwner ? 'YOU' : 'OTHER'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500">WETH Balance</span>
                            <span className="text-xs text-white font-mono">
                                {parseFloat(formatEther(contractBalance)).toFixed(6)} ETH
                            </span>
                        </div>
                    </div>

                    {/* Bot Executor Management */}
                    {isOwner && (
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-white uppercase tracking-tight">Bot Executor</span>
                                <span className="text-[10px] text-zinc-500">Can trigger trades, cannot withdraw</span>
                            </div>
                            <p className="text-[11px] text-zinc-400">
                                Add your bot wallet as an executor for autonomous trading. The bot can trigger trades but only YOU (owner) can withdraw profits.
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={executorAddress}
                                    onChange={(e) => setExecutorAddress(e.target.value)}
                                    placeholder="0x... (bot wallet address)"
                                    className="flex-1 bg-zinc-900 border border-card-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary font-mono"
                                />
                            </div>
                            {isExecutorAuthorized !== null && executorAddress.length === 42 && (
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${isExecutorAuthorized ? 'bg-accent' : 'bg-zinc-600'}`}></span>
                                    <span className="text-[11px] text-zinc-400">
                                        {isExecutorAuthorized ? 'Currently authorized' : 'Not authorized'}
                                    </span>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleSetExecutor(true)}
                                    disabled={isSettingExecutor || !executorAddress || isExecutorAuthorized === true}
                                    className="flex-1 py-2 px-3 bg-accent hover:bg-accent/80 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white text-xs font-bold uppercase rounded-lg transition-colors"
                                >
                                    {isSettingExecutor ? 'Processing...' : 'Authorize'}
                                </button>
                                <button
                                    onClick={() => handleSetExecutor(false)}
                                    disabled={isSettingExecutor || !executorAddress || isExecutorAuthorized === false}
                                    className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white text-xs font-bold uppercase rounded-lg transition-colors"
                                >
                                    Revoke
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    {isOwner && (
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={handleTogglePause}
                                className={`py-2 px-3 text-xs font-bold uppercase rounded-lg transition-colors ${isPaused
                                        ? 'bg-accent hover:bg-accent/80 text-white'
                                        : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                                    }`}
                            >
                                {isPaused ? 'Unpause' : 'Pause'}
                            </button>
                            <button
                                onClick={handleWithdraw}
                                disabled={contractBalance === BigInt(0)}
                                className="py-2 px-3 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white text-xs font-bold uppercase rounded-lg transition-colors"
                            >
                                Withdraw
                            </button>
                        </div>
                    )}

                    {/* Clear */}
                    <button
                        onClick={clearContract}
                        className="w-full py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                        Disconnect Contract
                    </button>
                </div>
            )}
        </div>
    );
}
