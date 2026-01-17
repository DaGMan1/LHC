'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function WalletConnect() {
    const account = useAccount()
    const { connectors, connect, status, error } = useConnect()
    const { disconnect } = useDisconnect()

    return (
        <div className="flex flex-col gap-4 p-6 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl">
            <h2 className="text-xl font-bold text-white">Wallet Connection</h2>

            {account.status === 'connected' ? (
                <div className="flex flex-col gap-2">
                    <p className="text-sm text-zinc-400">
                        Connected as: <span className="text-zinc-100 font-mono">{account.address}</span>
                    </p>
                    <button
                        onClick={() => disconnect()}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
                    >
                        Disconnect
                    </button>
                </div>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {connectors.map((connector) => (
                        <button
                            key={connector.uid}
                            onClick={() => connect({ connector })}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all"
                        >
                            Connect {connector.name}
                        </button>
                    ))}
                </div>
            )}

            {error && <p className="text-red-500 text-xs">{error.message}</p>}
        </div>
    )
}
