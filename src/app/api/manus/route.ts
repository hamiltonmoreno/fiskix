import { NextRequest, NextResponse } from 'next/server'
import { manusChat, createManusTask, getManusTask, analisarAlertaComManus } from '@/lib/manus/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'chat': {
        const { messages } = body
        if (!messages || !Array.isArray(messages)) {
          return NextResponse.json({ error: 'messages obrigatório' }, { status: 400 })
        }
        const result = await manusChat({ messages })
        return NextResponse.json(result)
      }

      case 'criar-tarefa': {
        const { prompt, context } = body
        if (!prompt) {
          return NextResponse.json({ error: 'prompt obrigatório' }, { status: 400 })
        }
        const result = await createManusTask({ prompt, context })
        return NextResponse.json(result)
      }

      case 'consultar-tarefa': {
        const { taskId } = body
        if (!taskId) {
          return NextResponse.json({ error: 'taskId obrigatório' }, { status: 400 })
        }
        const result = await getManusTask(taskId)
        return NextResponse.json(result)
      }

      case 'analisar-alerta': {
        const { clienteId, score, motivo, historico } = body
        if (!clienteId || score === undefined || !motivo) {
          return NextResponse.json(
            { error: 'clienteId, score e motivo são obrigatórios' },
            { status: 400 }
          )
        }
        const analise = await analisarAlertaComManus({ clienteId, score, motivo, historico })
        return NextResponse.json({ analise })
      }

      default:
        return NextResponse.json({ error: `Ação desconhecida: ${action}` }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno'
    console.error('[Manus API]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
