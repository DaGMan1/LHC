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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function IntelProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<IntelMessage[]>([])
    const [latestPriority, setLatestPriority] = useState<IntelMessage | null>(null)
    const [botStates, setBotStates] = useState<BotState[]>([])

    useEffect(() => {
        let eventSource: EventSource | null = null;
        let reconnectTimeout: NodeJS.Timeout | null = null;
        let isUnmounted = false;

        const connect = () => {
            if (isUnmounted) return;

            console.log('[IntelProvider] Connecting to:', `${API_URL}/api/intel`);
            eventSource = new EventSource(`${API_URL}/api/intel`);

            eventSource.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);

                    if (payload.type === 'intel') {
                        const data: IntelMessage = payload.data;
                        setMessages((prev) => [data, ...prev].slice(0, 50));

                        if (data.priority === 'high') {
                            setLatestPriority(data);
                            // Auto-clear priority message after 10 seconds
                            setTimeout(() => {
                                setLatestPriority((prev) => (prev === data ? null : prev));
                            }, 10000);
                        }
                    } else if (payload.type === 'bots') {
                        setBotStates(payload.data);
                    }
                } catch (err) {
                    console.error('[IntelProvider] Failed to parse SSE message:', err);
                }
            };

            eventSource.onerror = (err) => {
                console.error('[IntelProvider] SSE Error, reconnecting in 3s...', err);
                eventSource?.close();
                eventSource = null;

                // Reconnect after delay if not unmounted
                if (!isUnmounted) {
                    reconnectTimeout = setTimeout(connect, 3000);
                }
            };
        };

        connect();

        return () => {
            isUnmounted = true;
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            eventSource?.close();
        };
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
