'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface IntelMessage {
    time: string;
    msg: string;
    type: 'info' | 'success' | 'warning' | 'error';
    priority: 'low' | 'high';
}

interface IntelContextType {
    messages: IntelMessage[];
    latestPriority: IntelMessage | null;
}

const IntelContext = createContext<IntelContextType | undefined>(undefined)

export function IntelProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<IntelMessage[]>([])
    const [latestPriority, setLatestPriority] = useState<IntelMessage | null>(null)

    useEffect(() => {
        const eventSource = new EventSource('http://localhost:3001/api/intel')

        eventSource.onmessage = (event) => {
            const data: IntelMessage = JSON.parse(event.data)

            setMessages((prev) => [data, ...prev].slice(0, 50))

            if (data.priority === 'high') {
                setLatestPriority(data)
                // Auto-clear priority message after 10 seconds to keep the terminal feeling fresh
                setTimeout(() => {
                    setLatestPriority(prev => prev === data ? null : prev)
                }, 10000)
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
        <IntelContext.Provider value={{ messages, latestPriority }}>
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
