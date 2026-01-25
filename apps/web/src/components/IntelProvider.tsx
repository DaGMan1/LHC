'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface IntelMessage {
    time: string;
    msg: string;
    type: 'info' | 'success' | 'warning' | 'error';
    priority: 'low' | 'high';
}

export interface BotState {
    id: string;
    name: string;
    status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR';
    pnl: number;
    allocated: number;
    lastUpdate: string;
    logs: string[];
}

interface IntelContextType {
    messages: IntelMessage[];
    latestPriority: IntelMessage | null;
    botStates: BotState[];
}

const IntelContext = createContext<IntelContextType | undefined>(undefined)

export function IntelProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<IntelMessage[]>([])
    const [latestPriority, setLatestPriority] = useState<IntelMessage | null>(null)
    const [botStates, setBotStates] = useState<BotState[]>([])

    useEffect(() => {
        const eventSource = new EventSource('http://localhost:3001/api/intel')

        eventSource.onmessage = (event) => {
            const payload = JSON.parse(event.data)

            if (payload.type === 'intel') {
                const data: IntelMessage = payload.data
                setMessages((prev) => [data, ...prev].slice(0, 50))

                if (data.priority === 'high') {
                    setLatestPriority(data)
                    // Auto-clear priority message after 10 seconds to keep the terminal feeling fresh
                    setTimeout(() => {
                        setLatestPriority(prev => prev === data ? null : prev)
                    }, 10000)
                }
            } else if (payload.type === 'bots') {
                setBotStates(payload.data)
            }
        }

        eventSource.onerror = (err) => {
            console.error('SSE Error:', err)
            eventSource.close()
        }

        return () => {
            eventSource.close()
        }
    }, [])

    return (
        <IntelContext.Provider value={{ messages, latestPriority, botStates }}>
            {children}
        </IntelContext.Provider>
    )
}

export function useIntelContext() {
    const context = useContext(IntelContext)
    if (context === undefined) {
        throw new Error('useIntelContext must be used within an IntelProvider')
    }
    return context
}
