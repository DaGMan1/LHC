'use client'

import { useState, useEffect } from 'react'

export interface IntelMessage {
    time: string;
    msg: string;
    type: 'info' | 'success' | 'warning' | 'error';
    priority: 'low' | 'high';
}

export function useIntelFeed() {
    const [messages, setMessages] = useState<IntelMessage[]>([])
    const [latestPriority, setLatestPriority] = useState<IntelMessage | null>(null)

    useEffect(() => {
        const eventSource = new EventSource('http://localhost:3001/api/intel')

        eventSource.onmessage = (event) => {
            const data: IntelMessage = JSON.parse(event.data)

            setMessages((prev) => [data, ...prev].slice(0, 50))

            if (data.priority === 'high') {
                setLatestPriority(data)
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

    return { messages, latestPriority }
}
