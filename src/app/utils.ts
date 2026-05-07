import { agentSelectionsStorageKey, appearanceStorageKey, defaultAgentSelections, defaultAppearanceSettings, defaultPromptTemplates, fallbackAgentSelections, promptTemplatesStorageKey } from './config'
import type { AppearanceSettings, AreaAgentSelections, AreaPromptTemplates, BoardAreaId } from './types'
import type { OpenCodeAgent, OpenCodeMessage, OpenCodeProject } from '../opencodeClient'

export function classNames(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function mergeMessages(currentMessages: OpenCodeMessage[], nextMessages: OpenCodeMessage[]) {
  const messages = new Map(currentMessages.map((message) => [message.info.id, message]))

  nextMessages.forEach((message) => messages.set(message.info.id, message))

  return Array.from(messages.values()).sort((first, second) => {
    const firstCreated = first.info.time?.created ?? 0
    const secondCreated = second.info.time?.created ?? 0

    if (firstCreated !== secondCreated) return firstCreated - secondCreated

    return first.info.id.localeCompare(second.info.id)
  })
}

export function upsertById<T extends { id: string }>(items: T[], item: T) {
  return items.some((currentItem) => currentItem.id === item.id)
    ? items.map((currentItem) => (currentItem.id === item.id ? item : currentItem))
    : [item, ...items]
}

export function loadAgentSelections() {
  const storedValue = localStorage.getItem(agentSelectionsStorageKey)

  if (!storedValue) return defaultAgentSelections

  try {
    return { ...defaultAgentSelections, ...JSON.parse(storedValue) } as AreaAgentSelections
  } catch {
    return defaultAgentSelections
  }
}

export function saveAgentSelections(selections: AreaAgentSelections) {
  localStorage.setItem(agentSelectionsStorageKey, JSON.stringify(selections))
}

export function loadPromptTemplates() {
  const storedValue = localStorage.getItem(promptTemplatesStorageKey)

  if (!storedValue) return defaultPromptTemplates

  try {
    return { ...defaultPromptTemplates, ...JSON.parse(storedValue) } as AreaPromptTemplates
  } catch {
    return defaultPromptTemplates
  }
}

export function savePromptTemplates(templates: AreaPromptTemplates) {
  localStorage.setItem(promptTemplatesStorageKey, JSON.stringify(templates))
}

export function renderPromptTemplate(template: string, userMessage: string) {
  return template.includes('{{user_message}}')
    ? template.replaceAll('{{user_message}}', userMessage.trim())
    : `${template.trim()}\n\n${userMessage.trim()}`.trim()
}

export function loadAppearanceSettings() {
  const storedValue = localStorage.getItem(appearanceStorageKey)

  if (!storedValue) return defaultAppearanceSettings

  try {
    const parsedValue = JSON.parse(storedValue) as Partial<AppearanceSettings>
    const theme = parsedValue.theme === 'opencode' || parsedValue.theme === 'cupertino'
      ? parsedValue.theme
      : defaultAppearanceSettings.theme
    const mode = parsedValue.mode === 'light' || parsedValue.mode === 'dark' || parsedValue.mode === 'system'
      ? parsedValue.mode
      : defaultAppearanceSettings.mode

    return { theme, mode }
  } catch {
    return defaultAppearanceSettings
  }
}

export function saveAppearanceSettings(settings: AppearanceSettings) {
  localStorage.setItem(appearanceStorageKey, JSON.stringify(settings))
}

export function normalizedAgentOptions(agents: OpenCodeAgent[]) {
  return [...agents].sort((a, b) => displayAgentName(a.name).localeCompare(displayAgentName(b.name)))
}

export function resolveAgentSelections(selections: AreaAgentSelections, agents: OpenCodeAgent[]) {
  return (Object.keys(selections) as BoardAreaId[]).reduce<AreaAgentSelections>((resolvedSelections, area) => {
    resolvedSelections[area] = selectedAgentName(area, selections[area], agents) ?? selections[area]
    return resolvedSelections
  }, { ...selections })
}

export function selectedAgentName(area: BoardAreaId, agentName: string, agents: OpenCodeAgent[]) {
  const availableAgentNames = new Set(agents.map((agent) => agent.name))

  if (availableAgentNames.has(agentName)) return agentName

  const fallbackAgentName = fallbackAgentSelections[area]

  if (availableAgentNames.has(fallbackAgentName)) return fallbackAgentName

  return agents[0]?.name
}

export function displayAgentName(agentName: string) {
  return agentName
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatRelativeTime(timestamp: number) {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000))

  if (seconds < 60) return 'just now'

  const minutes = Math.round(seconds / 60)

  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)

  if (hours < 24) return `${hours}h ago`

  return `${Math.round(hours / 24)}d ago`
}

export function projectLabel(project: OpenCodeProject) {
  if (project.name?.trim()) return project.name.trim()

  const parts = project.worktree.split('/').filter(Boolean)
  return parts.at(-1) ?? project.worktree
}
