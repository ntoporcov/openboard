export type OpenCodeTaskRequest = {
  title: string
  prompt: string
  agent: string
}

export type OpenCodeTaskResponse = {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
}

const opencodeBaseUrl = import.meta.env.VITE_OPENCODE_URL ?? 'http://localhost:4096'

export async function createOpenCodeTask(task: OpenCodeTaskRequest) {
  const response = await fetch(`${opencodeBaseUrl}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  })

  if (!response.ok) {
    throw new Error(`OpenCode request failed with ${response.status}`)
  }

  return (await response.json()) as OpenCodeTaskResponse
}
