import { create } from 'zustand'
import { latestAssistantMessagePreview, latestPhaseMarkerStatus } from './app/utils'
import type { BoardAreaId } from './app/types'
import type { OpenCodeMessage } from './opencodeClient'

type MessageStreamState = {
  messagesBySession: Record<string, OpenCodeMessage[]>
  previewsBySession: Record<string, string>
  loadingBySession: Record<string, boolean>
  setSessionLoading: (sessionId: string, loading: boolean) => void
  setSessionMessages: (sessionId: string, messages: OpenCodeMessage[]) => void
  updateSessionMessages: (sessionId: string, updater: (messages: OpenCodeMessage[]) => OpenCodeMessage[]) => void
  clearSessionMessages: (sessionId: string) => void
}

const emptyMessages: OpenCodeMessage[] = []

export const useMessageStreamStore = create<MessageStreamState>((set) => ({
  messagesBySession: {},
  previewsBySession: {},
  loadingBySession: {},
  setSessionLoading: (sessionId, loading) => {
    set((state) => ({
      loadingBySession: { ...state.loadingBySession, [sessionId]: loading },
    }))
  },
  setSessionMessages: (sessionId, messages) => {
    set((state) => ({
      messagesBySession: { ...state.messagesBySession, [sessionId]: messages },
      previewsBySession: { ...state.previewsBySession, [sessionId]: latestAssistantMessagePreview(messages) },
      loadingBySession: { ...state.loadingBySession, [sessionId]: false },
    }))
  },
  updateSessionMessages: (sessionId, updater) => {
    set((state) => {
      const messages = updater(state.messagesBySession[sessionId] ?? [])

      return {
        messagesBySession: { ...state.messagesBySession, [sessionId]: messages },
        previewsBySession: { ...state.previewsBySession, [sessionId]: latestAssistantMessagePreview(messages) },
        loadingBySession: { ...state.loadingBySession, [sessionId]: false },
      }
    })
  },
  clearSessionMessages: (sessionId) => {
    set((state) => {
      const messagesBySession = { ...state.messagesBySession }
      const previewsBySession = { ...state.previewsBySession }
      const loadingBySession = { ...state.loadingBySession }

      delete messagesBySession[sessionId]
      delete previewsBySession[sessionId]
      delete loadingBySession[sessionId]

      return { messagesBySession, previewsBySession, loadingBySession }
    })
  },
}))

export function useSessionMessages(sessionId: string | null | undefined) {
  return useMessageStreamStore((state) => (sessionId ? state.messagesBySession[sessionId] ?? emptyMessages : emptyMessages))
}

export function useSessionPreview(sessionId: string) {
  return useMessageStreamStore((state) => state.previewsBySession[sessionId] ?? '')
}

export function useSessionPreviewLoading(sessionId: string) {
  return useMessageStreamStore((state) => state.loadingBySession[sessionId] ?? false)
}

export function useSessionPhaseStatus(sessionId: string, area: BoardAreaId) {
  return useMessageStreamStore((state) => latestPhaseMarkerStatus(state.messagesBySession[sessionId] ?? emptyMessages, area))
}
