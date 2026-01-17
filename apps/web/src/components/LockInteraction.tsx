'use client'

import { useReadContract, useWriteContract, useAccount } from 'wagmi'
import { LOCK_ABI } from '@/config/abi'
import { formatEther } from 'viem'
import { useState, useEffect } from 'react'

const LOCK_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3' // Default Hardhat local address

export function LockInteraction() {
    const account = useAccount()
    const [isPending, setIsPending] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const { data: unlockTime } = useReadContract({
        address: LOCK_ADDRESS,
        abi: LOCK_ABI,
        functionName: 'unlockTime',
    })

    const { data: owner } = useReadContract({
        address: LOCK_ADDRESS,
        abi: LOCK_ABI,
        functionName: 'owner',
    })

    const { writeContractAsync } = useWriteContract()

    const handleWithdraw = async () => {
        setIsPending(true)
        try {
            await writeContractAsync({
                address: LOCK_ADDRESS,
                abi: LOCK_ABI,
                functionName: 'withdraw',
            })
        } catch (err) {
            console.error('Withdrawal failed:', err)
        } finally {
            setIsPending(false)
        }
    }

    if (account.status !== 'connected') return null

    return (
        <div className="flex flex-col gap-4 p-6 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl mt-4">
            <h2 className="text-xl font-bold text-white">Contract Interaction</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-800 rounded-xl">
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Unlock Time</p>
                    <p className="text-lg text-zinc-100 font-mono">
                        {mounted && unlockTime ? new Date(Number(unlockTime) * 1000).toLocaleString() : 'Loading...'}
                    </p>
                </div>

                <div className="p-4 bg-zinc-800 rounded-xl">
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Owner</p>
                    <p className="text-sm text-zinc-100 font-mono truncate">
                        {owner ? (owner as string) : 'Loading...'}
                    </p>
                </div>
            </div>

            <button
                onClick={handleWithdraw}
                disabled={isPending}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20"
            >
                {isPending ? 'Processing...' : 'Withdraw Funds'}
            </button>
        </div>
    )
}
