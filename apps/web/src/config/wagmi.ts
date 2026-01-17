import { http, createConfig } from 'wagmi'
import { base, hardhat } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
    chains: [base, hardhat],
    connectors: [
        injected(),
    ],
    transports: {
        [base.id]: http(),
        [hardhat.id]: http(),
    },
})

