import { agentSelectionsStorageKey, appearanceStorageKey, boardProjectDirectoryStorageKey, defaultAgentSelections, defaultAppearanceSettings, defaultPromptTemplates, fallbackAgentSelections, phaseReadinessInstructions, projectAgentSelectionsStorageKey, projectPromptTemplatesStorageKey, promptTemplatesStorageKey } from './config'
import type { AppearanceSettings, AreaAgentSelections, AreaPromptTemplates, BoardAreaId, ProjectAgentSelections, ProjectPromptTemplates } from './types'
import type { OpenCodeAgent, OpenCodeMessage, OpenCodeMessagePart, OpenCodeProject } from '../opencodeClient'

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

export function upsertMessageInfo(currentMessages: OpenCodeMessage[], info: OpenCodeMessage['info']) {
  return sortMessages(
    currentMessages.some((message) => message.info.id === info.id)
      ? currentMessages.map((message) => (message.info.id === info.id ? { ...message, info } : message))
      : [...currentMessages, { info, parts: [] }],
  )
}

export function upsertMessagePart(currentMessages: OpenCodeMessage[], part: OpenCodeMessagePart) {
  return currentMessages.map((message) => {
    if (message.info.id !== part.messageID) return message

    const parts = message.parts.some((currentPart) => currentPart.id === part.id)
      ? message.parts.map((currentPart) => (currentPart.id === part.id ? part : currentPart))
      : [...message.parts, part]

    return { ...message, parts: sortMessageParts(parts) }
  })
}

export function applyMessagePartDelta(
  currentMessages: OpenCodeMessage[],
  input: { messageID: string; partID: string; field: string; delta: string },
) {
  return currentMessages.map((message) => {
    if (message.info.id !== input.messageID) return message

    return {
      ...message,
      parts: message.parts.map((part) => {
        if (part.id !== input.partID) return part

        const currentValue = part[input.field]

        if (typeof currentValue !== 'string' && currentValue !== undefined) return part

        return { ...part, [input.field]: `${currentValue ?? ''}${input.delta}` }
      }),
    }
  })
}

export function removeMessage(currentMessages: OpenCodeMessage[], messageID: string) {
  return currentMessages.filter((message) => message.info.id !== messageID)
}

export function removeMessagePart(currentMessages: OpenCodeMessage[], input: { messageID: string; partID: string }) {
  return currentMessages.map((message) => {
    if (message.info.id !== input.messageID) return message

    return { ...message, parts: message.parts.filter((part) => part.id !== input.partID) }
  })
}

export function latestAssistantMessagePreview(messages: OpenCodeMessage[]) {
  const text = [...messages]
    .reverse()
    .filter((message) => message.info.role === 'assistant')
    .map((message) => message.parts
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n\n')
      .trim())
    .find(Boolean)

  if (!text) return ''

  return lastSentences(stripMarkdown(text), 2)
}

export function lastSentences(text: string, count: number) {
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  const sentences = normalizedText.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean)

  return (sentences?.length ? sentences.slice(-count).join(' ') : normalizedText).trim()
}

function sortMessages(messages: OpenCodeMessage[]) {
  return [...messages].sort((first, second) => {
    const firstCreated = first.info.time?.created ?? 0
    const secondCreated = second.info.time?.created ?? 0

    if (firstCreated !== secondCreated) return firstCreated - secondCreated

    return first.info.id.localeCompare(second.info.id)
  })
}

function sortMessageParts(parts: OpenCodeMessagePart[]) {
  return [...parts].sort((first, second) => first.id.localeCompare(second.id))
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

export function loadProjectAgentSelections() {
  return loadProjectSettings<ProjectAgentSelections>(projectAgentSelectionsStorageKey)
}

export function saveProjectAgentSelections(selections: ProjectAgentSelections) {
  localStorage.setItem(projectAgentSelectionsStorageKey, JSON.stringify(selections))
}

export function loadBoardProjectDirectory() {
  return localStorage.getItem(boardProjectDirectoryStorageKey) ?? ''
}

export function saveBoardProjectDirectory(directory: string) {
  localStorage.setItem(boardProjectDirectoryStorageKey, directory)
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

export function loadProjectPromptTemplates() {
  return loadProjectSettings<ProjectPromptTemplates>(projectPromptTemplatesStorageKey)
}

export function saveProjectPromptTemplates(templates: ProjectPromptTemplates) {
  localStorage.setItem(projectPromptTemplatesStorageKey, JSON.stringify(templates))
}

function loadProjectSettings<T extends Record<string, unknown>>(storageKey: string) {
  const storedValue = localStorage.getItem(storageKey)

  if (!storedValue) return {} as T

  try {
    const parsedValue = JSON.parse(storedValue)
    return parsedValue && typeof parsedValue === 'object' ? parsedValue as T : {} as T
  } catch {
    return {} as T
  }
}

export function renderPromptTemplate(template: string, userMessage: string, area?: BoardAreaId) {
  const rendered = template.includes('{{user_message}}')
    ? template.replaceAll('{{user_message}}', userMessage.trim())
    : `${template.trim()}\n\n${userMessage.trim()}`.trim()

  return area ? appendPhaseReadinessInstruction(rendered, area) : rendered
}

export function appendPhaseReadinessInstruction(message: string, area: BoardAreaId) {
  const instruction = phaseReadinessInstructions[area]
  const trimmedMessage = message.trim()

  if (trimmedMessage.includes(instruction) || includesPhaseMarker(trimmedMessage, area)) return trimmedMessage

  return `${trimmedMessage}\n\n${instruction}`.trim()
}

const phaseMarkers: Record<BoardAreaId, string[]> = {
  prep: [],
  plan: ['[[PLAN_DONE]]', '[[PLAN_CHECK]]'],
  build: ['[[DEV_DONE]]', '[[DEV_CHECK]]'],
  review: ['[[REVIEW_APPROVED]]', '[[REVIEW_CHECK]]'],
  test: ['[[TEST_APPROVED]]', '[[TEST_CHECK]]'],
}

function includesPhaseMarker(message: string, area: BoardAreaId) {
  return phaseMarkers[area].some((marker) => message.includes(marker))
}

function stripMarkdown(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function loadAppearanceSettings() {
  const storedValue = localStorage.getItem(appearanceStorageKey)

  if (!storedValue) return defaultAppearanceSettings

  try {
    const parsedValue = JSON.parse(storedValue) as Partial<AppearanceSettings>
    const theme = parsedValue.theme === 'opencode' || parsedValue.theme === 'cupertino' || parsedValue.theme === 'linear'
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
