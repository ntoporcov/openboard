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
  requestHeaders: OpenCodeRequestHeader[]
}

export type OpenCodeRequestHeader = {
  name: string
  value: string
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
  parentID?: string
  workspaceID?: string
  time: {
    created: number
    updated: number
  }
}

export type OpenCodeSessionStatus =
  | { type: 'idle' }
  | { type: 'busy' }
  | { type: 'retry'; attempt: number; message: string; next: number }

export type OpenCodeProject = {
  id: string
  worktree: string
  vcs?: 'git'
  name?: string
  sandboxes?: string[]
  time?: {
    created: number
    updated: number
    initialized?: number
  }
}

export type OpenCodeAgent = {
  name: string
  description?: string
  mode: 'subagent' | 'primary' | 'all'
  native?: boolean
  hidden?: boolean
  color?: string
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
  filename?: string
  mime?: string
  url?: string
  tool?: string
  state?: {
    status?: string
    title?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type OpenCodeTextPartInput = {
  id: string
  type: 'text'
  text: string
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
    partID?: string
    field?: string
    delta?: string
    info?: unknown
    part?: OpenCodeMessagePart
    [key: string]: unknown
  }
}

export type OpenCodeQuestionRequest = {
  id: string
  sessionID: string
  questions: Array<{
    question: string
    header: string
    options: Array<{ label: string; description: string }>
    multiple?: boolean
    custom?: boolean
  }>
  tool?: {
    messageID: string
    callID: string
  }
}

export type OpenCodePermissionRequest = {
  id: string
  sessionID: string
  permission: string
  patterns: string[]
  metadata: Record<string, unknown>
  always: string[]
  tool?: {
    messageID: string
    callID: string
  }
}

export const defaultOpenCodeServerConfig: OpenCodeServerConfig = {
  baseUrl: import.meta.env.VITE_OPENCODE_URL ?? 'http://127.0.0.1:4096',
  username: 'opencode',
  password: '',
  requestHeaders: [],
}

const connectionStorageKey = 'openboard.opencode.connection'
const idLength = 26
const idPrefixes = {
  message: 'msg',
  part: 'prt',
} as const
let lastIdTimestamp = 0
let idCounter = 0

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

  normalizeRequestHeaders(config.requestHeaders).forEach((header) => {
    headers.set(header.name, header.value)
  })

  return headers
}

export function normalizeRequestHeaders(headers: OpenCodeRequestHeader[] | undefined) {
  if (!Array.isArray(headers)) {
    return []
  }

  return headers.reduce<OpenCodeRequestHeader[]>((normalizedHeaders, header) => {
    const name = String(header?.name ?? '').trim()
    const value = String(header?.value ?? '').trim()

    if (name && value) {
      normalizedHeaders.push({ name, value })
    }

    return normalizedHeaders
  }, [])
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

export function createOpenCodeId(prefix: keyof typeof idPrefixes) {
  return createAscendingId(prefix)
}

export function createOpenCodeTextPart(text: string): OpenCodeTextPartInput {
  return {
    id: createOpenCodeId('part'),
    type: 'text' as const,
    text,
  }
}

function createAscendingId(prefix: keyof typeof idPrefixes, timestamp = Date.now()) {
  if (timestamp !== lastIdTimestamp) {
    lastIdTimestamp = timestamp
    idCounter = 0
  }

  idCounter += 1

  const encodedTime = BigInt(timestamp) * BigInt(0x1000) + BigInt(idCounter)
  const timeBytes = new Uint8Array(6)

  for (let index = 0; index < 6; index += 1) {
    timeBytes[index] = Number((encodedTime >> BigInt(40 - 8 * index)) & BigInt(0xff))
  }

  return `${idPrefixes[prefix]}_${bytesToHex(timeBytes)}${randomBase62(idLength - 12)}`
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function randomBase62(length: number) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('')
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
      requestHeaders: normalizeRequestHeaders(parsed.requestHeaders),
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
    requestHeaders: normalizeRequestHeaders(config.requestHeaders),
  }

  localStorage.setItem(connectionStorageKey, JSON.stringify(normalizedConfig))
  return normalizedConfig
}

export function clearOpenCodeServerConfig() {
  localStorage.removeItem(connectionStorageKey)
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

export async function deleteOpenCodeSession(
  config: OpenCodeServerConfig,
  input: { sessionID: string },
) {
  const url = requestUrl(config, `/session/${input.sessionID}`)
  const response = await fetch(url, requestInit(config, { method: 'DELETE' }))

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `OpenCode session delete failed with ${response.status}.`)
  }

  return (await response.json()) as boolean
}

export async function listOpenCodeSessionChildren(
  config: OpenCodeServerConfig,
  input: { sessionID: string },
) {
  const response = await fetch(requestUrl(config, `/session/${input.sessionID}/children`), requestInit(config))

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `OpenCode session children request failed with ${response.status}.`)
  }

  return (await response.json()) as OpenCodeSession[]
}

export async function listOpenCodeSessionStatuses(config: OpenCodeServerConfig) {
  const response = await fetch(requestUrl(config, '/session/status'), requestInit(config))

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `OpenCode session status request failed with ${response.status}.`)
  }

  return (await response.json()) as Record<string, OpenCodeSessionStatus>
}

export async function listOpenCodeProjects(config: OpenCodeServerConfig) {
  const response = await fetch(requestUrl(config, '/project'), requestInit(config))

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `OpenCode projects request failed with ${response.status}.`)
  }

  return (await response.json()) as OpenCodeProject[]
}

export async function listOpenCodeAgents(config: OpenCodeServerConfig, input?: { directory?: string }) {
  const response = await fetch(requestUrl(config, '/agent', { directory: input?.directory }), requestInit(config))

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `OpenCode agents request failed with ${response.status}.`)
  }

  return (await response.json()) as OpenCodeAgent[]
}

export async function listOpenCodeQuestions(config: OpenCodeServerConfig) {
  const response = await fetch(requestUrl(config, '/question'), requestInit(config))

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `OpenCode questions request failed with ${response.status}.`)
  }

  return (await response.json()) as OpenCodeQuestionRequest[]
}

export async function replyOpenCodeQuestion(
  config: OpenCodeServerConfig,
  input: { requestID: string; answers: string[][] },
) {
  const response = await fetch(
    requestUrl(config, `/question/${input.requestID}/reply`),
    requestInit(config, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: input.answers }),
    }),
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `OpenCode question reply failed with ${response.status}.`)
  }

  return (await response.json()) as boolean
}

export async function listOpenCodePermissions(config: OpenCodeServerConfig) {
  const response = await fetch(requestUrl(config, '/permission'), requestInit(config))

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `OpenCode permissions request failed with ${response.status}.`)
  }

  return (await response.json()) as OpenCodePermissionRequest[]
}

export async function replyOpenCodePermission(
  config: OpenCodeServerConfig,
  input: { requestID: string; reply: 'once' | 'always' | 'reject' },
) {
  const response = await fetch(
    requestUrl(config, `/permission/${input.requestID}/reply`),
    requestInit(config, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: input.reply }),
    }),
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `OpenCode permission reply failed with ${response.status}.`)
  }

  return (await response.json()) as boolean
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
  input: {
    sessionID: string
    directory: string
    text: string
    agent?: string
    messageID?: string
    part?: OpenCodeTextPartInput
  },
) {
  const url = requestUrl(config, `/session/${input.sessionID}/message`, { directory: input.directory })
  const response = await fetch(
    url,
    requestInit(config, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(input.messageID ? { messageID: input.messageID } : {}),
        ...(input.agent ? { agent: input.agent } : {}),
        parts: [input.part ?? createOpenCodeTextPart(input.text)],
      }),
    }),
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `OpenCode prompt failed with ${response.status}.`)
  }

  return readJsonResponse<OpenCodeMessage>(response)
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

  return readJsonResponse<OpenCodeTaskResponse>(response)
}

async function readJsonResponse<T>(response: Response) {
  const body = await response.text()

  if (!body.trim()) {
    return null
  }

  return JSON.parse(body) as T
}
