/**
 * Manus API Client (server-side only)
 * https://api.manus.im
 */

const MANUS_BASE_URL = 'https://api.manus.im/v1'

function getApiKey(): string {
  const key = process.env.MANUS_API_KEY
  if (!key) throw new Error('MANUS_API_KEY não configurada')
  return key
}

export interface ManusTaskRequest {
  prompt: string
  context?: string
}

export interface ManusTaskResponse {
  task_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: string
  error?: string
}

export interface ManusMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ManusChatRequest {
  messages: ManusMessage[]
  stream?: boolean
}

export interface ManusChatResponse {
  id: string
  choices: Array<{
    message: ManusMessage
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

async function manusRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${MANUS_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Manus API erro ${response.status}: ${error}`)
  }

  return response.json() as Promise<T>
}

/**
 * Cria uma tarefa no Manus para análise assíncrona
 */
export async function createManusTask(req: ManusTaskRequest): Promise<ManusTaskResponse> {
  return manusRequest<ManusTaskResponse>('/tasks', {
    method: 'POST',
    body: JSON.stringify({ prompt: req.prompt, context: req.context }),
  })
}

/**
 * Consulta o estado de uma tarefa Manus
 */
export async function getManusTask(taskId: string): Promise<ManusTaskResponse> {
  return manusRequest<ManusTaskResponse>(`/tasks/${taskId}`)
}

/**
 * Chat síncrono com o agente Manus (análise imediata)
 */
export async function manusChat(req: ManusChatRequest): Promise<ManusChatResponse> {
  return manusRequest<ManusChatResponse>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      messages: req.messages,
      stream: false,
    }),
  })
}

/**
 * Análise de fraude: envia dados de alerta e recebe recomendações do Manus
 */
export async function analisarAlertaComManus(dados: {
  clienteId: string
  score: number
  motivo: Record<string, unknown>
  historico?: string
}): Promise<string> {
  const prompt = `Analisa este alerta de fraude de energia elétrica:
- Cliente ID: ${dados.clienteId}
- Score de risco: ${dados.score}/100
- Motivos detetados: ${JSON.stringify(dados.motivo, null, 2)}
${dados.historico ? `- Histórico: ${dados.historico}` : ''}

Fornece:
1. Avaliação do risco (Crítico/Médio/Baixo)
2. Possíveis causas da anomalia
3. Recomendações para inspeção no terreno
4. Prioridade de ação (urgente/normal/monitorar)`

  const response = await manusChat({
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  return response.choices[0]?.message.content ?? 'Sem resposta do agente'
}
