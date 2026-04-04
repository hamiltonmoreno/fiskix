'use client'

import { useState, useCallback } from 'react'

export interface ManusMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UseManusChatReturn {
  messages: ManusMessage[]
  loading: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  reset: () => void
}

export function useManusChat(): UseManusChatReturn {
  const [messages, setMessages] = useState<ManusMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: ManusMessage = { role: 'user', content }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/manus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          messages: updatedMessages,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'Erro na comunicação com Manus')
      }

      const assistantContent = data.choices?.[0]?.message?.content ?? 'Sem resposta'
      setMessages((prev: ManusMessage[]) => [...prev, { role: 'assistant', content: assistantContent }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [messages])

  const reset = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, loading, error, sendMessage, reset }
}

interface UseManusAlertaReturn {
  analise: string | null
  loading: boolean
  error: string | null
  analisar: (params: {
    clienteId: string
    score: number
    motivo: Record<string, unknown>
    historico?: string
  }) => Promise<void>
}

export function useManusAlerta(): UseManusAlertaReturn {
  const [analise, setAnalise] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analisar = useCallback(async (params: {
    clienteId: string
    score: number
    motivo: Record<string, unknown>
    historico?: string
  }) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/manus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analisar-alerta', ...params }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'Erro na análise')
      }

      setAnalise(data.analise)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  return { analise, loading, error, analisar }
}
