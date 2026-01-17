'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { config } from '../config/wagmi'
import { IntelProvider } from './IntelProvider'

export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient())

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <IntelProvider>
                    {children}
                </IntelProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}
