import { Button } from '@base-ui/react/button'
import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { AppearanceControls } from './components/appearance/AppearanceControls'
import { KanbanBoard } from './components/board/KanbanBoard'
import { AreaConfigModal } from './components/modals/AreaConfigModal'
import { ConnectionModal } from './components/modals/ConnectionModal'
import { PluginModal } from './components/modals/PluginModal'
import { CreatePrepSessionForm } from './components/prep/CreatePrepSessionForm'
import { PrepLane } from './components/prep/PrepLane'
import { PrepSidebar } from './components/prep/PrepSidebar'
import { columns } from './app/config'
import type { AppearanceSettings, BoardAreaId, Card, ColumnId, ConnectionState, PermissionReply, SessionEvent, SidebarState } from './app/types'
import {
  classNames,
  appendPhaseReadinessInstruction,
  applyMessagePartDelta,
  loadAgentSelections,
  loadAppearanceSettings,
  loadBoardProjectDirectory,
  loadProjectAgentSelections,
  loadProjectPromptTemplates,
  loadPromptTemplates,
  mergeMessages,
  projectLabel,
  removeMessage,
  removeMessagePart,
  renderPromptTemplate,
  resolveAgentSelections,
  saveAppearanceSettings,
  saveBoardProjectDirectory,
  saveProjectAgentSelections,
  saveProjectPromptTemplates,
  selectedAgentName,
  upsertMessageInfo,
  upsertMessagePart,
  upsertById,
} from './app/utils'
import {
  clearOpenCodeServerConfig,
  createOpenCodeId,
  createOpenCodeSession,
  createOpenCodeTextPart,
  defaultOpenCodeServerConfig,
  deleteOpenCodeSession,
  listOpenCodeAgents,
  listOpenCodeMessages,
  listOpenCodePermissions,
  listOpenCodeProjects,
  listOpenCodeQuestions,
  listOpenCodeSessionChildren,
  listOpenCodeSessionStatuses,
  loadOpenCodeServerConfig,
  replyOpenCodePermission,
  replyOpenCodeQuestion,
  saveOpenCodeServerConfig,
  sendOpenCodePrompt,
  subscribeOpenCodeEvents,
  validateOpenCodeConnection,
  type OpenCodeEvent,
  type OpenCodeAgent,
  type OpenCodeHealthResponse,
  type OpenCodeMessage,
  type OpenCodePermissionRequest,
  type OpenCodeProject,
  type OpenCodeQuestionRequest,
  type OpenCodeSession,
  type OpenCodeSessionStatus,
  type OpenCodeServerConfig,
} from './opencodeClient'
import { useMessageStreamStore } from './messageStreamStore'
import {
  createPrepSessionId,
  deletePrepSession,
  listCards,
  listPrepSessions,
  saveCard,
  saveCards,
  savePrepSession,
  type OpenBoardPrepSession,
} from './openboardDb'

function App() {
  const [cards, setCards] = useState<Card[]>([])
  const [connectionModalOpen, setConnectionModalOpen] = useState(() => !loadOpenCodeServerConfig())
  const [pluginModalOpen, setPluginModalOpen] = useState(false)
  const [configArea, setConfigArea] = useState<BoardAreaId | null>(null)
  const [prepSessions, setPrepSessions] = useState<OpenBoardPrepSession[]>([])
  const [openedChildSessions, setOpenedChildSessions] = useState<OpenBoardPrepSession[]>([])
  const [sidebarState, setSidebarState] = useState<SidebarState>('closed')
  const [activePrepSessionId, setActivePrepSessionId] = useState<string | null>(null)
  const [childSessions, setChildSessions] = useState<OpenCodeSession[]>([])
  const [questions, setQuestions] = useState<OpenCodeQuestionRequest[]>([])
  const [permissions, setPermissions] = useState<OpenCodePermissionRequest[]>([])
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([])
  const [opencodeSessionStatuses, setOpenCodeSessionStatuses] = useState<Record<string, OpenCodeSessionStatus>>({})
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [projects, setProjects] = useState<OpenCodeProject[]>([])
  const [boardProjectDirectory, setBoardProjectDirectory] = useState(loadBoardProjectDirectory)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [agents, setAgents] = useState<OpenCodeAgent[]>([])
  const [agentError, setAgentError] = useState<string | null>(null)
  const [agentSelectionsByProject, setAgentSelectionsByProject] = useState(loadProjectAgentSelections)
  const [promptTemplatesByProject, setPromptTemplatesByProject] = useState(loadProjectPromptTemplates)
  const [appearance, setAppearance] = useState(loadAppearanceSettings)
  const [connection, setConnection] = useState<ConnectionState>(() => {
    const config = loadOpenCodeServerConfig()

    return {
      config,
      health: null,
      status: config ? 'checking' : 'idle',
      error: null,
    }
  })

  const activePrepSession = [...prepSessions, ...openedChildSessions].find((session) => session.id === activePrepSessionId) ?? null
  const fallbackAgentSelectionsForProject = useMemo(() => loadAgentSelections(), [])
  const fallbackPromptTemplatesForProject = useMemo(() => loadPromptTemplates(), [])
  const sortedProjects = useMemo(() => [...projects].sort((a, b) => projectLabel(a).localeCompare(projectLabel(b))), [projects])
  const selectedBoardProjectDirectory = sortedProjects.some((project) => project.worktree === boardProjectDirectory)
    ? boardProjectDirectory
    : sortedProjects[0]?.worktree ?? ''
  const boardProject = sortedProjects.find((project) => project.worktree === selectedBoardProjectDirectory) ?? null
  const boardProjectLabel = boardProject ? projectLabel(boardProject) : 'No projects'
  const boardProjectSelectWidth = `${Math.max(8, Math.min(24, boardProjectLabel.length + 2))}ch`
  const boardAgents = selectedBoardProjectDirectory ? agents : []
  const displayedAgentError = agentError ?? (!selectedBoardProjectDirectory ? 'Select a project before choosing agents.' : null)
  const agentSelections = selectedBoardProjectDirectory
    ? agentSelectionsByProject[selectedBoardProjectDirectory] ?? fallbackAgentSelectionsForProject
    : fallbackAgentSelectionsForProject
  const promptTemplates = selectedBoardProjectDirectory
    ? promptTemplatesByProject[selectedBoardProjectDirectory] ?? fallbackPromptTemplatesForProject
    : fallbackPromptTemplatesForProject
  const visiblePrepSessions = prepSessions.filter((session) => session.status === 'prepping' && session.projectDirectory === selectedBoardProjectDirectory)
  const selectedProjectSessionIds = new Set(prepSessions.filter((session) => session.projectDirectory === selectedBoardProjectDirectory).map((session) => session.id))
  const visibleCards = cards.filter((card) => selectedProjectSessionIds.has(card.id))
  const resolvedAgentSelections = resolveAgentSelections(agentSelections, boardAgents)
  const busySessionIds = useMemo(() => new Set(
    [...prepSessions, ...openedChildSessions]
      .filter((session) => opencodeSessionStatuses[session.opencodeSessionId]?.type === 'busy')
      .map((session) => session.id),
  ), [openedChildSessions, opencodeSessionStatuses, prepSessions])
  const setSessionLoading = useMessageStreamStore((state) => state.setSessionLoading)
  const setSessionMessages = useMessageStreamStore((state) => state.setSessionMessages)
  const updateSessionMessages = useMessageStreamStore((state) => state.updateSessionMessages)
  const clearSessionMessages = useMessageStreamStore((state) => state.clearSessionMessages)

  useEffect(() => {
    let cancelled = false

    listCards()
      .then((storedCards) => {
        if (!cancelled) setCards(storedCards)
      })
      .catch((error: unknown) => {
        if (!cancelled) setSessionError(error instanceof Error ? error.message : 'Unable to load board cards.')
      })

    listPrepSessions()
      .then((sessions) => {
        if (!cancelled) setPrepSessions(sessions)
      })
      .catch((error: unknown) => {
        if (!cancelled) setSessionError(error instanceof Error ? error.message : 'Unable to load prep sessions.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!connection.config) return

    let cancelled = false

    validateOpenCodeConnection(connection.config)
      .then((health) => {
        if (cancelled) return

        setConnection((currentConnection) => ({
          ...currentConnection,
          health,
          status: 'connected',
          error: null,
        }))
      })
      .catch((error: unknown) => {
        if (cancelled) return

        setConnection((currentConnection) => ({
          ...currentConnection,
          health: null,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unable to connect to OpenCode.',
        }))
        setConnectionModalOpen(true)
      })

    return () => {
      cancelled = true
    }
  }, [connection.config])

  useEffect(() => {
    if (connection.status !== 'connected' || !connection.config) return

    let cancelled = false

    listOpenCodeProjects(connection.config)
      .then((nextProjects) => {
        if (!cancelled) {
          setProjects(nextProjects)
          setProjectError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setProjectError(error instanceof Error ? error.message : 'Unable to load OpenCode projects.')
      })

    return () => {
      cancelled = true
    }
  }, [connection.config, connection.status])

  useEffect(() => {
    if (selectedBoardProjectDirectory && selectedBoardProjectDirectory !== boardProjectDirectory) {
      saveBoardProjectDirectory(selectedBoardProjectDirectory)
    }
  }, [boardProjectDirectory, selectedBoardProjectDirectory])

  useEffect(() => {
    if (connection.status !== 'connected' || !connection.config || prepSessions.length === 0) return

    let cancelled = false
    const config = connection.config
    const cardIds = new Set(cards.map((card) => card.id))
    const previewSessions = prepSessions.filter((session) => session.status === 'prepping' || cardIds.has(session.id))

    previewSessions.forEach((session) => {
      if (Object.hasOwn(useMessageStreamStore.getState().messagesBySession, session.id)) return

      setSessionLoading(session.id, true)
      void listOpenCodeMessages(config, {
        sessionID: session.opencodeSessionId,
        directory: session.projectDirectory,
      })
        .then((nextMessages) => {
          if (!cancelled) setSessionMessages(session.id, nextMessages)
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setSessionLoading(session.id, false)
            setSessionError(error instanceof Error ? error.message : 'Unable to load card conversation previews.')
          }
        })
    })

    return () => {
      cancelled = true
    }
  }, [cards, connection.config, connection.status, prepSessions, setSessionLoading, setSessionMessages])

  useEffect(() => {
    if (connection.status !== 'connected' || !connection.config || !activePrepSession) return

    let cancelled = false

    Promise.allSettled([listOpenCodeQuestions(connection.config), listOpenCodePermissions(connection.config)])
      .then(([questionResult, permissionResult]) => {
        if (cancelled) return

        if (questionResult.status === 'fulfilled') setQuestions(questionResult.value)
        if (permissionResult.status === 'fulfilled') setPermissions(permissionResult.value)
      })

    return () => {
      cancelled = true
    }
  }, [activePrepSession, connection.config, connection.status])

  useEffect(() => {
    if (connection.status !== 'connected' || !connection.config) return

    let cancelled = false

    Promise.allSettled([listOpenCodeQuestions(connection.config), listOpenCodePermissions(connection.config)])
      .then(([questionResult, permissionResult]) => {
        if (cancelled) return

        if (questionResult.status === 'fulfilled') setQuestions(questionResult.value)
        if (permissionResult.status === 'fulfilled') setPermissions(permissionResult.value)
      })

    return () => {
      cancelled = true
    }
  }, [connection.config, connection.status])

  useEffect(() => {
    if (connection.status !== 'connected' || !connection.config) return

    let cancelled = false

    listOpenCodeSessionStatuses(connection.config)
      .then((statuses) => {
        if (!cancelled) setOpenCodeSessionStatuses(statuses)
      })
      .catch(() => {
        if (!cancelled) setOpenCodeSessionStatuses({})
      })

    return () => {
      cancelled = true
    }
  }, [connection.config, connection.status])

  useEffect(() => {
    if (connection.status !== 'connected' || !connection.config) return

    if (!selectedBoardProjectDirectory) return

    let cancelled = false

    listOpenCodeAgents(connection.config, { directory: selectedBoardProjectDirectory })
      .then((nextAgents) => {
        if (!cancelled) {
          setAgents(nextAgents.filter((agent) => !agent.hidden))
          setAgentError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setAgentError(error instanceof Error ? error.message : 'Unable to load OpenCode agents.')
      })

    return () => {
      cancelled = true
    }
  }, [connection.config, connection.status, selectedBoardProjectDirectory])

  useEffect(() => {
    if (!connection.config || !activePrepSession) return

    let cancelled = false

    listOpenCodeMessages(connection.config, {
      sessionID: activePrepSession.opencodeSessionId,
      directory: activePrepSession.projectDirectory,
    })
      .then((nextMessages) => {
        if (!cancelled) {
          setSessionMessages(activePrepSession.id, nextMessages)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setSessionError(error instanceof Error ? error.message : 'Unable to load OpenCode messages.')
      })

    return () => {
      cancelled = true
    }
  }, [activePrepSession, connection.config, setSessionMessages])

  useEffect(() => {
    if (!connection.config || !activePrepSession) return

    let cancelled = false

    listOpenCodeSessionChildren(connection.config, { sessionID: activePrepSession.opencodeSessionId })
      .then((sessions) => {
        if (!cancelled) setChildSessions(sessions)
      })
      .catch(() => {
        if (!cancelled) setChildSessions([])
      })

    return () => {
      cancelled = true
    }
  }, [activePrepSession, connection.config])

  useEffect(() => {
    const config = connection.config

    if (!config) return


    return subscribeOpenCodeEvents(config, {
      onEvent: (event) => {
        const payload = event.payload
        const sessionID = getOpenCodeEventSessionID(payload)
        const prepSession = [...prepSessions, ...openedChildSessions].find((session) => session.opencodeSessionId === sessionID)

        if (!prepSession) return

        if (payload.type === 'session.status') {
          const status = payload.properties?.status as OpenCodeSessionStatus | undefined

          if (sessionID && status?.type) {
            setOpenCodeSessionStatuses((currentStatuses) => {
              const nextStatuses = { ...currentStatuses }

              if (status.type === 'idle') {
                delete nextStatuses[sessionID]
              } else {
                nextStatuses[sessionID] = status
              }

              return nextStatuses
            })
          }
        }

        if (payload.type === 'session.idle' && sessionID) {
          setOpenCodeSessionStatuses((currentStatuses) => {
            const nextStatuses = { ...currentStatuses }
            delete nextStatuses[sessionID]
            return nextStatuses
          })
        }

        if (payload.type === 'message.updated') {
          const info = payload.properties?.info as OpenCodeMessage['info'] | undefined
          if (info) updateSessionMessages(prepSession.id, (currentMessages) => upsertMessageInfo(currentMessages, info))
        }

        if (payload.type === 'message.part.updated') {
          const part = payload.properties?.part
          if (part?.messageID) updateSessionMessages(prepSession.id, (currentMessages) => upsertMessagePart(currentMessages, part))
        }

        if (payload.type === 'message.part.delta') {
          const messageID = typeof payload.properties?.messageID === 'string' ? payload.properties.messageID : null
          const partID = typeof payload.properties?.partID === 'string' ? payload.properties.partID : null
          const field = typeof payload.properties?.field === 'string' ? payload.properties.field : null
          const delta = typeof payload.properties?.delta === 'string' ? payload.properties.delta : null

          if (messageID && partID && field && delta) {
            updateSessionMessages(prepSession.id, (currentMessages) => applyMessagePartDelta(currentMessages, { messageID, partID, field, delta }))
          }
        }

        if (payload.type === 'message.removed') {
          const messageID = typeof payload.properties?.messageID === 'string' ? payload.properties.messageID : null
          if (messageID) updateSessionMessages(prepSession.id, (currentMessages) => removeMessage(currentMessages, messageID))
        }

        if (payload.type === 'message.part.removed') {
          const messageID = typeof payload.properties?.messageID === 'string' ? payload.properties.messageID : null
          const partID = typeof payload.properties?.partID === 'string' ? payload.properties.partID : null
          if (messageID && partID) updateSessionMessages(prepSession.id, (currentMessages) => removeMessagePart(currentMessages, { messageID, partID }))
        }

        setSessionEvents((currentEvents) => [{ id: `${Date.now()}-${payload.type}`, type: payload.type, at: Date.now() }, ...currentEvents].slice(0, 8))

        if (prepSession.id !== activePrepSessionId) return

        if (payload.type === 'message.part.updated') {
          void listOpenCodeSessionChildren(config, { sessionID: prepSession.opencodeSessionId })
            .then(setChildSessions)
            .catch(() => {})
        }

        if (payload.type === 'question.asked') {
          setQuestions((currentQuestions) => upsertById(currentQuestions, payload.properties as OpenCodeQuestionRequest))
        }

        if (payload.type === 'question.replied') {
          const requestID = typeof payload.properties?.requestID === 'string' ? payload.properties.requestID : null
          if (requestID) setQuestions((currentQuestions) => currentQuestions.filter((question) => question.id !== requestID))
        }

        if (payload.type === 'permission.asked') {
          setPermissions((currentPermissions) => upsertById(currentPermissions, payload.properties as OpenCodePermissionRequest))
        }

        if (payload.type === 'permission.replied') {
          const requestID = typeof payload.properties?.requestID === 'string' ? payload.properties.requestID : null
          if (requestID) setPermissions((currentPermissions) => currentPermissions.filter((permission) => permission.id !== requestID))
        }
      },
      onError: (error) => setSessionError(error.message),
    })
  }, [activePrepSessionId, connection.config, openedChildSessions, prepSessions, updateSessionMessages])

  function handleConnectionValidated(config: OpenCodeServerConfig, health: OpenCodeHealthResponse) {
    const savedConfig = saveOpenCodeServerConfig(config)

    setConnection({ config: savedConfig, health, status: 'connected', error: null })
    setConnectionModalOpen(false)
  }

  function handleDisconnect() {
    clearOpenCodeServerConfig()
    setConnection({ config: null, health: null, status: 'idle', error: null })
    setProjects([])
    setAgents([])
    setOpenCodeSessionStatuses({})
    setProjectError(null)
    setAgentError(null)
  }

  function handleBoardProjectSelected(directory: string) {
    setBoardProjectDirectory(directory)
    saveBoardProjectDirectory(directory)
    setActivePrepSessionId(null)
    setSidebarState('closed')
    setAgentError(null)
  }

  function handleOpenPrepSession(session: OpenBoardPrepSession) {
    setActivePrepSessionId(session.id)
    setSidebarState('open')
    setSessionError(null)
  }

  function handleOpenCard(card: Card) {
    const session = prepSessions.find((prepSession) => prepSession.id === card.id)

    if (!session) {
      setSessionError('Unable to find the OpenCode session for this card.')
      return
    }

    handleOpenPrepSession(session)
  }

  function handleOpenChildSession(session: OpenCodeSession) {
    const childSession = prepSessionFromOpenCodeSession(session)

    setOpenedChildSessions((currentSessions) => {
      if (currentSessions.some((item) => item.id === childSession.id)) return currentSessions

      return [childSession, ...currentSessions]
    })
    setActivePrepSessionId(childSession.id)
    setSidebarState('open')
    setSessionError(null)
  }

  function handleAgentSelected(area: BoardAreaId, agentName: string) {
    if (!selectedBoardProjectDirectory) return

    setAgentSelectionsByProject((currentSelectionsByProject) => {
      const currentSelections = currentSelectionsByProject[selectedBoardProjectDirectory] ?? fallbackAgentSelectionsForProject
      const nextSelectionsByProject = {
        ...currentSelectionsByProject,
        [selectedBoardProjectDirectory]: { ...currentSelections, [area]: agentName },
      }
      saveProjectAgentSelections(nextSelectionsByProject)
      return nextSelectionsByProject
    })
  }

  function handleAppearanceChange(nextAppearance: Partial<AppearanceSettings>) {
    setAppearance((currentAppearance) => {
      const updatedAppearance = { ...currentAppearance, ...nextAppearance }
      saveAppearanceSettings(updatedAppearance)
      return updatedAppearance
    })
  }

  function handlePromptTemplateSaved(area: BoardAreaId, template: string) {
    if (!selectedBoardProjectDirectory) return

    setPromptTemplatesByProject((currentTemplatesByProject) => {
      const currentTemplates = currentTemplatesByProject[selectedBoardProjectDirectory] ?? fallbackPromptTemplatesForProject
      const nextTemplatesByProject = {
        ...currentTemplatesByProject,
        [selectedBoardProjectDirectory]: { ...currentTemplates, [area]: template },
      }
      saveProjectPromptTemplates(nextTemplatesByProject)
      return nextTemplatesByProject
    })
    setConfigArea(null)
  }

  function handlePrepTicketDragStart(event: DragEvent<HTMLButtonElement>, session: OpenBoardPrepSession) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-openboard-prep-session', session.id)
    event.dataTransfer.setData('text/plain', session.title)
  }

  function handleCardsChange(nextCards: Card[] | ((cards: Card[]) => Card[])) {
    setCards((currentCards) => {
      const currentVisibleCards = currentCards.filter((card) => selectedProjectSessionIds.has(card.id))
      const nextResolvedCards = typeof nextCards === 'function' ? nextCards(currentVisibleCards) : nextCards
      const resolvedCards = nextResolvedCards.map((card) => {
        const currentCard = currentCards.find((item) => item.id === card.id)

        if (!currentCard || currentCard.status === card.status) return card

        const agentName = selectedAgentName(card.status, agentSelections[card.status], boardAgents)

        return agentName ? { ...card, agent: agentName } : card
      })
      const resolvedCardById = new Map(resolvedCards.map((card) => [card.id, card]))
      const mergedCards = [
        ...currentCards
          .filter((card) => !selectedProjectSessionIds.has(card.id))
          .concat(currentCards.filter((card) => selectedProjectSessionIds.has(card.id)).map((card) => resolvedCardById.get(card.id)).filter((card): card is Card => Boolean(card))),
        ...resolvedCards.filter((card) => !currentCards.some((currentCard) => currentCard.id === card.id)),
      ]

      void saveCards(resolvedCards).catch((error: unknown) => {
        setSessionError(error instanceof Error ? error.message : 'Unable to save board cards.')
      })

      return mergedCards
    })
  }

  async function handleCardStatusChange(card: Card, nextStatus: ColumnId) {
    const session = prepSessions.find((prepSession) => prepSession.id === card.id)

    if (!session) {
      setSessionError('Unable to find the OpenCode session for this card.')
      return
    }

    if (!connection.config) {
      setConnectionModalOpen(true)
      setSessionError('Connect to OpenCode before moving a ticket into another phase.')
      return
    }

    const agentName = selectedAgentName(nextStatus, agentSelections[nextStatus], boardAgents)

    if (!agentName) {
      setSessionError('OpenCode has not reported any available agents yet.')
      return
    }

    const ticketMessage = createTicketTemplateInput(session, nextStatus)
    const automatedMessage = renderPromptTemplate(promptTemplates[nextStatus], ticketMessage, nextStatus)

    setSessionError(null)

    try {
      await sendPrepPrompt(session, automatedMessage, nextStatus)
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : `Unable to send ${getAreaLabel(nextStatus)} message.`)
    }
  }

  async function handlePrepTicketDrop(columnId: ColumnId, prepSessionId: string) {
    if (columnId !== 'plan' && columnId !== 'build') return

    const prepSession = prepSessions.find((session) => session.id === prepSessionId)

    if (!prepSession) return

    if (!connection.config) {
      setConnectionModalOpen(true)
      setSessionError('Connect to OpenCode before moving a prep ticket into work.')
      return
    }

    const agentName = selectedAgentName(columnId, agentSelections[columnId], boardAgents)

    if (!agentName) {
      setSessionError('OpenCode has not reported any available agents yet.')
      return
    }

    const ticketMessage = createTicketTemplateInput(prepSession, columnId)
    const automatedMessage = renderPromptTemplate(promptTemplates[columnId], ticketMessage, columnId)
    const delegatedSession: OpenBoardPrepSession = {
      ...prepSession,
      status: 'delegated',
      updatedAt: prepSession.updatedAt + 1,
    }
    const nextCard: Card = {
      id: prepSession.id,
      title: prepSession.title,
      prompt: ticketMessage,
      status: columnId,
      agent: agentName,
    }

    await savePrepSession(delegatedSession)
    await saveCard(nextCard)
    setPrepSessions((currentSessions) => currentSessions.map((session) => (session.id === delegatedSession.id ? delegatedSession : session)))
    handleCardsChange((currentCards) => {
      const existingCard = currentCards.find((card) => card.id === nextCard.id)
      if (existingCard) {
        return currentCards.map((card) => (card.id === nextCard.id ? { ...card, status: columnId, agent: agentName } : card))
      }

      return [nextCard, ...currentCards]
    })
    setActivePrepSessionId(delegatedSession.id)
    setSidebarState('open')
    setSessionError(null)

    try {
      await sendPrepPrompt(delegatedSession, automatedMessage, columnId)
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : `Unable to send ${getAreaLabel(columnId)} message.`)
    }
  }

  async function handlePrepSessionCreated(input: { instruction: string }) {
    if (!connection.config) {
      setConnectionModalOpen(true)
      throw new Error('Connect to OpenCode before starting prep.')
    }

    if (!selectedBoardProjectDirectory) {
      throw new Error('Select a board project before starting prep.')
    }

    const title = createPrepSessionTitle(input.instruction)
    const opencodeSession = await createOpenCodeSession(connection.config, {
      title,
      directory: selectedBoardProjectDirectory,
    })
    const now = opencodeSession.time.created
    const prepSession = await savePrepSession({
      id: createPrepSessionId(),
      title: opencodeSession.title || title,
      projectDirectory: opencodeSession.directory || selectedBoardProjectDirectory,
      opencodeSessionId: opencodeSession.id,
      createdAt: now,
      updatedAt: now,
      status: 'prepping',
    })

    setPrepSessions((currentSessions) => [prepSession, ...currentSessions])
    clearSessionMessages(prepSession.id)
    setSessionError(null)
    setActivePrepSessionId(prepSession.id)
    setSidebarState('open')

    try {
      await sendPrepPrompt(prepSession, renderPromptTemplate(promptTemplates.prep, input.instruction, 'prep'), 'prep')
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Unable to send the starting prep instruction.')
    }
  }

  async function handlePrepSessionDelete(session: OpenBoardPrepSession) {
    await deletePrepSession(session.id)

    setPrepSessions((currentSessions) => currentSessions.filter((item) => item.id !== session.id))
    setOpenedChildSessions((currentSessions) => currentSessions.filter((item) => item.id !== session.id))
    clearSessionMessages(session.id)
    setChildSessions((currentSessions) => currentSessions.filter((item) => item.id !== session.opencodeSessionId))
    setSessionEvents([])

    if (activePrepSessionId === session.id) {
      setActivePrepSessionId(null)
      setSidebarState('closed')
    }

    if (!connection.config) return

    const openCodeDeleteError = await deleteOpenCodeSession(connection.config, { sessionID: session.opencodeSessionId })
      .then(() => null)
      .catch((error: unknown) => error)

    if (openCodeDeleteError) {
      setSessionError(openCodeDeleteError instanceof Error ? openCodeDeleteError.message : 'OpenBoard removed the prep session, but OpenCode deletion failed.')
    }
  }

  async function handlePromptSubmit(text: string) {
    if (!connection.config || !activePrepSession) return

    const area = getSessionArea(activePrepSession, cards)

    await sendPrepPrompt(activePrepSession, appendPhaseReadinessInstruction(text, area), area)
  }

  async function sendPrepPrompt(session: OpenBoardPrepSession, text: string, area: BoardAreaId) {
    if (!connection.config) return

    const agentName = selectedAgentName(area, agentSelections[area], boardAgents)

    if (!agentName) throw new Error('OpenCode has not reported any available agents yet.')

    const messageID = createOpenCodeId('message')
    const part = createOpenCodeTextPart(text)
    const optimisticMessage: OpenCodeMessage = {
      info: {
        id: messageID,
        role: 'user',
        sessionID: session.opencodeSessionId,
        time: { created: Date.now() },
      },
      parts: [{ ...part, messageID }],
    }

    updateSessionMessages(session.id, (currentMessages) => [...currentMessages, optimisticMessage])

    let submittedMessage: OpenCodeMessage | null = null

    try {
      submittedMessage = await sendOpenCodePrompt(connection.config, {
        sessionID: session.opencodeSessionId,
        directory: session.projectDirectory,
        text,
        agent: agentName,
        messageID,
        part,
      })
    } catch (error) {
      updateSessionMessages(session.id, (currentMessages) => currentMessages.filter((message) => message.info.id !== messageID))
      throw error
    }

    if (submittedMessage) updateSessionMessages(session.id, (currentMessages) => mergeMessages(currentMessages, [submittedMessage]))

    try {
      const nextMessages = await listOpenCodeMessages(connection.config, {
        sessionID: session.opencodeSessionId,
        directory: session.projectDirectory,
      })
      updateSessionMessages(session.id, (currentMessages) => mergeMessages(currentMessages, nextMessages))
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Unable to refresh OpenCode messages.')
    }
  }

  async function handleQuestionReply(requestID: string, answers: string[][]) {
    if (!connection.config) return

    await replyOpenCodeQuestion(connection.config, { requestID, answers })
    setQuestions((currentQuestions) => currentQuestions.filter((question) => question.id !== requestID))
  }

  async function handlePermissionReply(requestID: string, reply: PermissionReply) {
    if (!connection.config) return

    await replyOpenCodePermission(connection.config, { requestID, reply })
    setPermissions((currentPermissions) => currentPermissions.filter((permission) => permission.id !== requestID))
  }

  const connectionLabel = getConnectionLabel(connection)

  return (
    <main className="openboard-app relative min-h-svh min-w-max" data-mode={appearance.mode} data-theme={appearance.theme}>
      <div className="ob-backdrop pointer-events-none absolute inset-0" />
      <div className="ob-glow pointer-events-none absolute left-1/2 top-6 h-28 w-[min(760px,80vw)] -translate-x-1/2 rounded-full blur-3xl" />
      <div className="relative flex min-h-svh w-full flex-col py-4">
        <div
          className={classNames(
            'sticky left-0 right-0 z-20 w-screen px-4 transition-[width] duration-300 sm:px-6 lg:px-8',
            sidebarState !== 'closed'
              && 'min-[1380px]:right-[calc(500px_+_1.75rem)] min-[1380px]:w-[calc(100dvw_-_500px_-_1.75rem)]',
          )}
        >
          <header className="ob-surface mb-4 flex flex-col gap-3 rounded-[32px] px-4 py-3 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="ob-logo grid size-10 place-items-center rounded-[18px] text-sm font-semibold text-white">OB</div>
              <div>
                <h1 className="ob-text text-[1.05rem] font-semibold tracking-[-0.02em]">OpenBoard</h1>
                <p className="ob-muted text-sm">Kanban for AI coding work</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="ob-pill inline-flex max-w-[18rem] items-center gap-2 rounded-full px-2.5 py-1.5 text-sm backdrop-blur-xl" title={projectError ?? boardProject?.worktree ?? 'Select an OpenCode project'}>
                <span className="ob-muted shrink-0 text-xs font-medium">Project</span>
                <select
                  className="ob-text min-w-0 bg-transparent text-sm font-semibold outline-none disabled:opacity-60"
                  style={{ width: boardProjectSelectWidth }}
                  value={selectedBoardProjectDirectory}
                  disabled={connection.status !== 'connected' || sortedProjects.length === 0}
                  onChange={(event) => handleBoardProjectSelected(event.target.value)}
                >
                  {sortedProjects.length === 0 ? <option value="">No projects</option> : null}
                  {sortedProjects.map((project) => (
                    <option key={project.id} value={project.worktree}>{projectLabel(project)}</option>
                  ))}
                </select>
              </label>
              <AppearanceControls appearance={appearance} onChange={handleAppearanceChange} />
              <span className="ob-pill inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-sm backdrop-blur-xl">
                <button className="inline-flex items-center gap-2 px-1 outline-none" type="button" onClick={() => setConnectionModalOpen(true)}>
                  <span className={classNames('size-2 rounded-full', getConnectionDotColor(connection.status))} />
                  {connectionLabel}
                </button>
                {connection.config ? (
                  <Button className="ob-icon-button grid size-5 place-items-center rounded-full text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2" type="button" aria-label="Disconnect OpenCode" title="Disconnect OpenCode" onClick={handleDisconnect}>×</Button>
                ) : null}
              </span>
              <Button className="ob-secondary-button rounded-full px-4 py-2 text-sm font-medium backdrop-blur-xl transition focus-visible:outline-2 focus-visible:outline-offset-2" type="button" onClick={() => setPluginModalOpen(true)}>
                Plugin
              </Button>
            </div>
          </header>

          <PrepLane
            prepSessions={visiblePrepSessions}
            activePrepSessionId={activePrepSessionId}
            busySessionIds={busySessionIds}
            agents={boardAgents}
            agentError={displayedAgentError}
            selectedAgent={resolvedAgentSelections.prep}
            onAgentSelected={(agentName) => handleAgentSelected('prep', agentName)}
            onCreate={() => setSidebarState('new')}
            onConfigure={() => setConfigArea('prep')}
            onOpen={handleOpenPrepSession}
            onTicketDragStart={handlePrepTicketDragStart}
          />
        </div>

        <KanbanBoard
          columns={columns}
          cards={visibleCards}
          agents={boardAgents}
          agentSelections={resolvedAgentSelections}
          busySessionIds={busySessionIds}
          chatAffordance={sidebarState !== 'closed'}
          onCardsChange={handleCardsChange}
          onCardOpen={handleOpenCard}
          onCardStatusChange={handleCardStatusChange}
          onAgentSelected={handleAgentSelected}
          onConfigureArea={setConfigArea}
          onPrepTicketDrop={handlePrepTicketDrop}
        />
      </div>

      {connectionModalOpen ? (
        <ConnectionModal
          initialConfig={connection.config ?? defaultOpenCodeServerConfig}
          initialError={connection.error}
          onClose={() => setConnectionModalOpen(false)}
          onValidated={handleConnectionValidated}
        />
      ) : null}

      {pluginModalOpen ? <PluginModal onClose={() => setPluginModalOpen(false)} /> : null}

      {configArea ? (
        <AreaConfigModal
          area={configArea}
          areaLabel={getAreaLabel(configArea)}
          template={promptTemplates[configArea]}
          onClose={() => setConfigArea(null)}
          onSave={(template) => handlePromptTemplateSaved(configArea, template)}
        />
      ) : null}

      {sidebarState === 'new' ? (
        <CreatePrepSessionForm
          connected={connection.status === 'connected'}
          projectDirectory={selectedBoardProjectDirectory}
          projectLabel={boardProjectLabel}
          onClose={() => setSidebarState('closed')}
          onCreate={handlePrepSessionCreated}
        />
      ) : null}

      {sidebarState === 'open' ? (
        <PrepSidebar
          mode={sidebarState}
          session={activePrepSession}
          childSessions={childSessions}
          questions={questions}
          permissions={permissions}
          events={sessionEvents}
          error={sessionError}
          onClose={() => setSidebarState('closed')}
          onDelete={handlePrepSessionDelete}
          onOpenChildSession={handleOpenChildSession}
          onQuestionReply={handleQuestionReply}
          onPermissionReply={handlePermissionReply}
          onPromptSubmit={handlePromptSubmit}
        />
      ) : null}
    </main>
  )
}

function prepSessionFromOpenCodeSession(session: OpenCodeSession): OpenBoardPrepSession {
  const now = Date.now()

  return {
    id: `opencode:${session.id}`,
    title: session.title || 'Sub-agent session',
    projectDirectory: session.directory,
    opencodeSessionId: session.id,
    createdAt: session.time?.created ?? now,
    updatedAt: session.time?.updated ?? session.time?.created ?? now,
    status: 'prepping',
  }
}

function getOpenCodeEventSessionID(event: OpenCodeEvent) {
  const properties = event.properties

  if (typeof properties?.sessionID === 'string') return properties.sessionID
  if (properties?.part && typeof properties.part.sessionID === 'string') return properties.part.sessionID

  const info = properties?.info as OpenCodeMessage['info'] | undefined
  if (typeof info?.sessionID === 'string') return info.sessionID

  return undefined
}

function createPrepSessionTitle(instruction: string) {
  const firstLine = instruction
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) return 'Prep session'

  return firstLine.length > 64 ? `${firstLine.slice(0, 61).trimEnd()}...` : firstLine
}

function createTicketTemplateInput(session: OpenBoardPrepSession, area: ColumnId) {
  return `Ticket moved to ${getAreaLabel(area)}.

Prep session: ${session.title}
Project directory: ${session.projectDirectory}
OpenCode session ID: ${session.opencodeSessionId}

Use the existing conversation in this session as the source context.`
}

function getSessionArea(session: OpenBoardPrepSession, cards: Card[]): BoardAreaId {
  return cards.find((card) => card.id === session.id)?.status ?? 'prep'
}

function getConnectionLabel(connection: ConnectionState) {
  if (connection.status === 'checking') return 'Checking OpenCode'
  if (connection.status === 'connected') return connection.config ? new URL(connection.config.baseUrl).host : 'OpenCode connected'
  if (connection.status === 'failed') return 'OpenCode unavailable'
  return 'Not connected'
}

function getAreaLabel(area: BoardAreaId) {
  if (area === 'prep') return 'Prep'

  return columns.find((column) => column.id === area)?.title ?? area
}

function getConnectionDotColor(status: ConnectionState['status']) {
  if (status === 'connected') return 'bg-[#34c759]'
  if (status === 'checking') return 'bg-[#ffcc00]'
  if (status === 'failed') return 'bg-[#ff3b30]'
  return 'bg-[#86868b]'
}

export default App
