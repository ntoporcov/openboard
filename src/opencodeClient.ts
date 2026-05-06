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
