import type { OpenCodeHealthResponse, OpenCodeServerConfig } from '../opencodeClient'

export type BoardAreaId = 'prep' | 'plan' | 'build' | 'review' | 'test'
export type ColumnId = Exclude<BoardAreaId, 'prep'>

export type Card = {
  id: string
  title: string
  prompt: string
  status: ColumnId
  agent: string
}

export type Column = {
  id: ColumnId
  title: string
  description: string
}

export type AreaAgentSelections = Record<BoardAreaId, string>
export type AreaPromptTemplates = Record<BoardAreaId, string>

export type ConnectionState = {
  config: OpenCodeServerConfig | null
  health: OpenCodeHealthResponse | null
  status: 'idle' | 'checking' | 'connected' | 'failed'
  error: string | null
}

export type SessionEvent = {
  id: string
  type: string
  at: number
}

export type SidebarState = 'closed' | 'new' | 'open'

export type AppearanceTheme = 'cupertino' | 'opencode'
export type AppearanceMode = 'light' | 'dark' | 'system'

export type AppearanceSettings = {
  theme: AppearanceTheme
  mode: AppearanceMode
}

export type PermissionReply = 'once' | 'always' | 'reject'
