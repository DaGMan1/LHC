import { http, createConfig } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
    chains: [base, mainnet],
    connectors: [
        // Use injected connector - works with MetaMask, Coinbase, etc.
        injected({
            shimDisconnect: true,
        }),
    ],
    transports: {
        [base.id]: http('https://mainnet.base.org'),
        [mainnet.id]: http(),
    },
    ssr: true, // Enable SSR support for Next.js
})

