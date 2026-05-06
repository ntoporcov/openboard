export type OpenCodeTaskRequest = {
  title: string
  prompt: string
  agent: string
}

export type OpenCodeTaskResponse = {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
}

export type OpenCodeServerConfig = {
  baseUrl: string
  username: string
  password: string
}

export type OpenCodeHealthResponse = {
  healthy: boolean
  version: string
}

export type OpenCodeSession = {
  id: string
  title: string
  directory: string
  projectID: string
  workspaceID?: string
  time: {
    created: number
    updated: number
  }
}

export type OpenCodeMessage = {
  info: {
    id: string
    role: 'user' | 'assistant'
    sessionID: string
    time?: {
      created?: number
      completed?: number
    }
    agent?: string
    model?: {
      providerID: string
      modelID: string
    }
    error?: unknown
  }
  parts: OpenCodeMessagePart[]
}

export type OpenCodeMessagePart = {
  id: string
  type: string
  text?: string
  messageID?: string
}

export type OpenCodeEventEnvelope = {
  directory?: string
  payload: OpenCodeEvent
}

export type OpenCodeEvent = {
  type: string
  properties?: {
    sessionID?: string
    messageID?: string
    info?: unknown
    part?: OpenCodeMessagePart
    [key: string]: unknown
  }
}

export const defaultOpenCodeServerConfig: OpenCodeServerConfig = {
  baseUrl: import.meta.env.VITE_OPENCODE_URL ?? 'http://127.0.0.1:4096',
  username: 'opencode',
  password: '',
}

const connectionStorageKey = 'openboard.opencode.connection'

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '')
}

function authorizationHeader(config: OpenCodeServerConfig) {
  if (!config.username && !config.password) {
    return undefined
  }

  return `Basic ${btoa(`${config.username}:${config.password}`)}`
}

function requestHeaders(config: OpenCodeServerConfig) {
  const headers = new Headers({ Accept: 'application/json' })
  const authorization = authorizationHeader(config)

  if (authorization) {
    headers.set('Authorization', authorization)
  }

  return headers
}

function requestInit(config: OpenCodeServerConfig, init?: RequestInit) {
  const headers = requestHeaders(config)

  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  }

  return {
    ...init,
    headers,
  }
}

function requestUrl(config: OpenCodeServerConfig, path: string, query?: Record<string, string | undefined>) {
  const url = new URL(`${normalizeBaseUrl(config.baseUrl)}${path}`)

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  return url
}

export function loadOpenCodeServerConfig() {
  const storedValue = localStorage.getItem(connectionStorageKey)

  if (!storedValue) {
    return null
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<OpenCodeServerConfig>

    if (!parsed.baseUrl) {
      return null
    }

    return {
      baseUrl: normalizeBaseUrl(parsed.baseUrl),
      username: parsed.username ?? '',
      password: parsed.password ?? '',
    }
  } catch {
    return null
  }
}

export function saveOpenCodeServerConfig(config: OpenCodeServerConfig) {
  const normalizedConfig = {
    ...config,
    baseUrl: normalizeBaseUrl(config.baseUrl),
    username: config.username.trim(),
  }

  localStorage.setItem(connectionStorageKey, JSON.stringify(normalizedConfig))
  return normalizedConfig
}

export async function validateOpenCodeConnection(config: OpenCodeServerConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl)

  if (!baseUrl) {
    throw new Error('Enter an OpenCode server URL.')
  }

  const response = await fetch(`${baseUrl}/global/health`, {
    headers: requestHeaders(config),
  })

  if (!response.ok) {
    throw new Error(`OpenCode health check failed with ${response.status}.`)
  }

  const health = (await response.json()) as OpenCodeHealthResponse

  if (!health.healthy) {
    throw new Error('OpenCode server responded but is not healthy.')
  }

  return health
}

export async function createOpenCodeSession(
  config: OpenCodeServerConfig,
  input: { title: string; directory: string },
) {
  const url = requestUrl(config, '/session', { directory: input.directory.trim() })
  const response = await fetch(
    url,
    requestInit(config, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: input.title.trim() || undefined }),
    }),
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `OpenCode session create failed with ${response.status}.`)
  }

  return (await response.json()) as OpenCodeSession
}

export async function listOpenCodeMessages(
  config: OpenCodeServerConfig,
  input: { sessionID: string; directory: string },
) {
  const url = requestUrl(config, `/session/${input.sessionID}/message`, { directory: input.directory })
  const response = await fetch(url, requestInit(config))

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `OpenCode messages request failed with ${response.status}.`)
  }

  return (await response.json()) as OpenCodeMessage[]
}

export async function sendOpenCodePrompt(
  config: OpenCodeServerConfig,
  input: { sessionID: string; directory: string; text: string },
) {
  const url = requestUrl(config, `/session/${input.sessionID}/message`, { directory: input.directory })
  const response = await fetch(
    url,
    requestInit(config, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts: [
          {
            id: `part_${Date.now().toString(36)}`,
            type: 'text',
            text: input.text,
          },
        ],
      }),
    }),
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `OpenCode prompt failed with ${response.status}.`)
  }

  return (await response.json()) as OpenCodeMessage
}

export function subscribeOpenCodeEvents(
  config: OpenCodeServerConfig,
  handlers: {
    onEvent: (event: OpenCodeEventEnvelope) => void
    onError?: (error: Error) => void
  },
) {
  const controller = new AbortController()
  let stopped = false
  let retry: number | undefined

  async function connect() {
    try {
      const response = await fetch(
        requestUrl(config, '/global/event'),
        requestInit(config, { signal: controller.signal }),
      )

      if (!response.ok || !response.body) {
        throw new Error(`OpenCode event stream failed with ${response.status}.`)
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''

      while (!stopped) {
        const { value, done } = await reader.read()

        if (done) {
          break
        }

        buffer += value
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''

        chunks.forEach((chunk) => {
          const data = chunk
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n')

          if (!data || data === '[DONE]') {
            return
          }

          try {
            handlers.onEvent(JSON.parse(data) as OpenCodeEventEnvelope)
          } catch (error) {
            handlers.onError?.(error instanceof Error ? error : new Error('Invalid OpenCode event.'))
          }
        })
      }
    } catch (error) {
      if (!stopped && !controller.signal.aborted) {
        handlers.onError?.(error instanceof Error ? error : new Error('OpenCode event stream failed.'))
      }
    }

    if (!stopped && !controller.signal.aborted) {
      retry = window.setTimeout(connect, 500)
    }
  }

  void connect()

  return () => {
    stopped = true
    controller.abort()

    if (retry) {
      window.clearTimeout(retry)
    }
  }
}

export async function createOpenCodeTask(task: OpenCodeTaskRequest) {
  const config = loadOpenCodeServerConfig() ?? defaultOpenCodeServerConfig
  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/tasks`, {
    method: 'POST',
    headers: {
      ...Object.fromEntries(requestHeaders(config)),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(task),
  })

  if (!response.ok) {
    throw new Error(`OpenCode request failed with ${response.status}`)
  }

  return (await response.json()) as OpenCodeTaskResponse
}
