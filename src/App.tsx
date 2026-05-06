import { Button } from '@base-ui/react/button'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react'
import {
  createOpenCodeId,
  createOpenCodeSession,
  createOpenCodeTextPart,
  deleteOpenCodeSession,
  defaultOpenCodeServerConfig,
  listOpenCodeAgents,
  listOpenCodeMessages,
  listOpenCodeProjects,
  loadOpenCodeServerConfig,
  saveOpenCodeServerConfig,
  sendOpenCodePrompt,
  subscribeOpenCodeEvents,
  validateOpenCodeConnection,
  type OpenCodeAgent,
  type OpenCodeHealthResponse,
  type OpenCodeMessage,
  type OpenCodeMessagePart,
  type OpenCodeProject,
  type OpenCodeServerConfig,
} from './opencodeClient'
import {
  createPrepSessionId,
  deletePrepSession,
  listPrepSessions,
  savePrepSession,
  type OpenBoardPrepSession,
} from './openboardDb'

type BoardAreaId = 'prep' | 'plan' | 'build' | 'review' | 'test'
type ColumnId = Exclude<BoardAreaId, 'prep'>

type Card = {
  id: string
  title: string
  prompt: string
  status: ColumnId
  agent: string
}

type Column = {
  id: ColumnId
  title: string
  description: string
}

const columns: Column[] = [
  { id: 'plan', title: 'Plan', description: 'Shape work into clear steps.' },
  { id: 'build', title: 'Build', description: 'Implement scoped changes.' },
  { id: 'review', title: 'Review', description: 'Inspect diffs, risks, and quality.' },
  { id: 'test', title: 'Test', description: 'Validate behavior and regressions.' },
]

const initialCards: Card[] = []

type AreaAgentSelections = Record<BoardAreaId, string>

const defaultAgentSelections: AreaAgentSelections = {
  prep: 'openboard-prepper',
  plan: 'openboard-planner',
  build: 'openboard-builder',
  review: 'openboard-reviewer',
  test: 'openboard-tester',
}

const agentSelectionsStorageKey = 'openboard.agentSelections.v1'

type ConnectionState = {
  config: OpenCodeServerConfig | null
  health: OpenCodeHealthResponse | null
  status: 'idle' | 'checking' | 'connected' | 'failed'
  error: string | null
}

type SessionEvent = {
  id: string
  type: string
  at: number
}

type SidebarState = 'closed' | 'new' | 'open'

function App() {
  const [cards, setCards] = useState(initialCards)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [connectionModalOpen, setConnectionModalOpen] = useState(() => !loadOpenCodeServerConfig())
  const [prepSessions, setPrepSessions] = useState<OpenBoardPrepSession[]>([])
  const [sidebarState, setSidebarState] = useState<SidebarState>('closed')
  const [activePrepSessionId, setActivePrepSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<OpenCodeMessage[]>([])
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([])
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [projects, setProjects] = useState<OpenCodeProject[]>([])
  const [projectError, setProjectError] = useState<string | null>(null)
  const [agents, setAgents] = useState<OpenCodeAgent[]>([])
  const [agentError, setAgentError] = useState<string | null>(null)
  const [agentSelections, setAgentSelections] = useState(loadAgentSelections)
  const [connection, setConnection] = useState<ConnectionState>(() => {
    const config = loadOpenCodeServerConfig()

    return {
      config,
      health: null,
      status: config ? 'checking' : 'idle',
      error: null,
    }
  })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const activeCard = cards.find((card) => card.id === activeId) ?? null
  const activePrepSession = prepSessions.find((session) => session.id === activePrepSessionId) ?? null

  useEffect(() => {
    let cancelled = false

    listPrepSessions()
      .then((sessions) => {
        if (!cancelled) {
          setPrepSessions(sessions)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSessionError(error instanceof Error ? error.message : 'Unable to load prep sessions.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!connection.config) {
      return
    }

    let cancelled = false

    validateOpenCodeConnection(connection.config)
      .then((health) => {
        if (cancelled) {
          return
        }

        setConnection((currentConnection) => ({
          ...currentConnection,
          health,
          status: 'connected',
          error: null,
        }))
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

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
    if (connection.status !== 'connected' || !connection.config) {
      return
    }

    let cancelled = false

    listOpenCodeProjects(connection.config)
      .then((nextProjects) => {
        if (!cancelled) {
          setProjects(nextProjects)
          setProjectError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProjectError(error instanceof Error ? error.message : 'Unable to load OpenCode projects.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [connection.config, connection.status])

  useEffect(() => {
    if (connection.status !== 'connected' || !connection.config) {
      return
    }

    let cancelled = false

    listOpenCodeAgents(connection.config)
      .then((nextAgents) => {
        if (!cancelled) {
          setAgents(nextAgents.filter((agent) => !agent.hidden))
          setAgentError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAgentError(error instanceof Error ? error.message : 'Unable to load OpenCode agents.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [connection.config, connection.status])

  useEffect(() => {
    if (!connection.config || !activePrepSession) {
      return
    }

    let cancelled = false

    listOpenCodeMessages(connection.config, {
      sessionID: activePrepSession.opencodeSessionId,
      directory: activePrepSession.projectDirectory,
    })
      .then((nextMessages) => {
        if (!cancelled) {
          setMessages(nextMessages)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSessionError(error instanceof Error ? error.message : 'Unable to load OpenCode messages.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [activePrepSession, connection.config])

  useEffect(() => {
    const config = connection.config

    if (!config) {
      return
    }

    return subscribeOpenCodeEvents(config, {
      onEvent: (event) => {
        const payload = event.payload
        const sessionID = payload.properties?.sessionID
        const prepSession = prepSessions.find((session) => session.opencodeSessionId === sessionID)

        if (!prepSession) {
          return
        }

        setSessionEvents((currentEvents) =>
          [
            { id: `${Date.now()}-${payload.type}`, type: payload.type, at: Date.now() },
            ...currentEvents,
          ].slice(0, 8),
        )

        if (prepSession.id !== activePrepSessionId) {
          return
        }

        if (payload.type === 'message.updated' || payload.type === 'message.part.updated') {
          void listOpenCodeMessages(config, {
            sessionID: prepSession.opencodeSessionId,
            directory: prepSession.projectDirectory,
          })
            .then(setMessages)
            .catch((error: unknown) => {
              setSessionError(error instanceof Error ? error.message : 'Unable to refresh OpenCode messages.')
            })
        }
      },
      onError: (error) => setSessionError(error.message),
    })
  }, [activePrepSessionId, connection.config, prepSessions])

  function getColumnFromTarget(targetId: string): ColumnId | undefined {
    if (columns.some((column) => column.id === targetId)) {
      return targetId as ColumnId
    }

    return cards.find((card) => card.id === targetId)?.status
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) {
      return
    }

    const activeCardId = String(active.id)
    const overId = String(over.id)
    const nextStatus = getColumnFromTarget(overId)

    if (!nextStatus) {
      return
    }

    setCards((currentCards) => {
      const oldIndex = currentCards.findIndex((card) => card.id === activeCardId)
      const overIndex = currentCards.findIndex((card) => card.id === overId)

      if (oldIndex === -1) {
        return currentCards
      }

      const movedCard = { ...currentCards[oldIndex], status: nextStatus }
      const updatedCards = currentCards.toSpliced(oldIndex, 1, movedCard)

      if (overIndex === -1 || activeCardId === overId) {
        return updatedCards
      }

      return arrayMove(updatedCards, oldIndex, overIndex)
    })
  }

  function handleConnectionValidated(config: OpenCodeServerConfig, health: OpenCodeHealthResponse) {
    const savedConfig = saveOpenCodeServerConfig(config)

    setConnection({
      config: savedConfig,
      health,
      status: 'connected',
      error: null,
    })
    setConnectionModalOpen(false)
  }

  function handleOpenPrepSession(session: OpenBoardPrepSession) {
    setActivePrepSessionId(session.id)
    setSidebarState('open')
    setSessionError(null)
  }

  function handleAgentSelected(area: BoardAreaId, agentName: string) {
    setAgentSelections((currentSelections) => {
      const nextSelections = { ...currentSelections, [area]: agentName }
      saveAgentSelections(nextSelections)
      return nextSelections
    })
  }

  async function handlePrepSessionCreated(input: { title: string; projectDirectory: string }) {
    if (!connection.config) {
      setConnectionModalOpen(true)
      throw new Error('Connect to OpenCode before creating a prep session.')
    }

    const opencodeSession = await createOpenCodeSession(connection.config, {
      title: input.title,
      directory: input.projectDirectory,
    })
    const now = Date.now()
    const prepSession = await savePrepSession({
      id: createPrepSessionId(),
      title: opencodeSession.title || input.title || 'Untitled prep session',
      projectDirectory: opencodeSession.directory || input.projectDirectory,
      opencodeSessionId: opencodeSession.id,
      createdAt: now,
      updatedAt: now,
      status: 'prepping',
    })

    setPrepSessions((currentSessions) => [prepSession, ...currentSessions])
    setActivePrepSessionId(prepSession.id)
    setSidebarState('open')
  }

  async function handlePrepSessionDelete(session: OpenBoardPrepSession) {
    if (!connection.config) {
      throw new Error('Connect to OpenCode before deleting this prep session.')
    }

    await deleteOpenCodeSession(connection.config, {
      sessionID: session.opencodeSessionId,
      directory: session.projectDirectory,
    })
    await deletePrepSession(session.id)

    setPrepSessions((currentSessions) => currentSessions.filter((item) => item.id !== session.id))
    setMessages([])
    setSessionEvents([])

    if (activePrepSessionId === session.id) {
      setActivePrepSessionId(null)
      setSidebarState('closed')
    }
  }

  async function handlePromptSubmit(text: string) {
    if (!connection.config || !activePrepSession) {
      return
    }

    const messageID = createOpenCodeId('message')
    const part = createOpenCodeTextPart(text)
    const optimisticMessage: OpenCodeMessage = {
      info: {
        id: messageID,
        role: 'user',
        sessionID: activePrepSession.opencodeSessionId,
        time: { created: Date.now() },
      },
      parts: [{ ...part, messageID }],
    }

    setMessages((currentMessages) => [...currentMessages, optimisticMessage])

    try {
      await sendOpenCodePrompt(connection.config, {
        sessionID: activePrepSession.opencodeSessionId,
        directory: activePrepSession.projectDirectory,
        text,
        agent: selectedAgentName(agentSelections.prep, agents),
        messageID,
        part,
      })
    } catch (error) {
      setMessages((currentMessages) => currentMessages.filter((message) => message.info.id !== messageID))
      throw error
    }

    const nextMessages = await listOpenCodeMessages(connection.config, {
      sessionID: activePrepSession.opencodeSessionId,
      directory: activePrepSession.projectDirectory,
    })
    setMessages(nextMessages)
  }

  const connectionLabel = getConnectionLabel(connection)

  return (
    <main className="relative min-h-svh min-w-max bg-[#f5f5f7] text-[#1d1d1f]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(0,122,255,0.20),transparent_32%),radial-gradient(circle_at_78%_8%,rgba(90,200,250,0.18),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f5f7fb_44%,#eef3f9_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-6 h-28 w-[min(760px,80vw)] -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />
      <div
        className="relative flex min-h-svh w-full flex-col py-4"
      >
        <div
          className={classNames(
            'sticky left-0 right-0 z-20 w-screen px-4 transition-[width] duration-300 sm:px-6 lg:px-8',
            sidebarState !== 'closed' && '2xl:right-[548px] 2xl:w-[calc(100vw-548px)]',
          )}
        >
          <header className="mb-4 flex flex-col gap-3 rounded-[32px] border border-white/70 bg-white/55 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_24px_70px_rgba(0,64,128,0.12)] backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-[18px] bg-[linear-gradient(145deg,#0a84ff,#0066d6)] text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_28px_rgba(0,122,255,0.32)]">
                OB
              </div>
              <div>
                <h1 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
                  OpenBoard
                </h1>
                <p className="text-sm text-[#6e6e73]">Kanban for AI coding work</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/50 px-3 py-1.5 text-sm text-[#6e6e73] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl">
                <span className={classNames('size-2 rounded-full', getConnectionDotColor(connection.status))} />
                {connectionLabel}
              </span>
              <Button
                className="rounded-full border border-white/70 bg-white/60 px-4 py-2 text-sm font-medium text-[#007aff] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_22px_rgba(0,64,128,0.08)] backdrop-blur-xl transition hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]"
                type="button"
                onClick={() => setConnectionModalOpen(true)}
              >
                Connect
              </Button>
              <Button
                className="rounded-full bg-[#007aff] px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_26px_rgba(0,122,255,0.34)] transition hover:bg-[#0a84ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]"
                type="button"
                onClick={() => setSidebarState('new')}
              >
                Create prep
              </Button>
            </div>
          </header>

          <PrepLane
            prepSessions={prepSessions}
            activePrepSessionId={activePrepSessionId}
            agents={agents}
            agentError={agentError}
            selectedAgent={agentSelections.prep}
            onAgentSelected={(agentName) => handleAgentSelected('prep', agentName)}
            onCreate={() => setSidebarState('new')}
            onOpen={handleOpenPrepSession}
          />
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section
            className="grid flex-1 grid-cols-[repeat(4,minmax(230px,1fr))] gap-3 px-4 pb-3 sm:px-6 lg:px-8"
            aria-label="Kanban board"
          >
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={cards.filter((card) => card.status === column.id)}
                agents={agents}
                selectedAgent={agentSelections[column.id]}
                onAgentSelected={(agentName) => handleAgentSelected(column.id, agentName)}
              />
            ))}
          </section>

          <DragOverlay>{activeCard ? <TaskCard card={activeCard} overlay /> : null}</DragOverlay>
        </DndContext>
      </div>

      {connectionModalOpen ? (
        <ConnectionModal
          initialConfig={connection.config ?? defaultOpenCodeServerConfig}
          initialError={connection.error}
          onClose={() => setConnectionModalOpen(false)}
          onValidated={handleConnectionValidated}
        />
      ) : null}

      {sidebarState !== 'closed' ? (
        <PrepSidebar
          mode={sidebarState}
          session={activePrepSession}
          messages={messages}
          events={sessionEvents}
          error={sessionError}
          connected={connection.status === 'connected'}
          projects={projects}
          projectError={projectError}
          onClose={() => setSidebarState('closed')}
          onCreate={handlePrepSessionCreated}
          onDelete={handlePrepSessionDelete}
          onPromptSubmit={handlePromptSubmit}
        />
      ) : null}
    </main>
  )
}

function ConnectionModal({
  initialConfig,
  initialError,
  onClose,
  onValidated,
}: {
  initialConfig: OpenCodeServerConfig
  initialError: string | null
  onClose: () => void
  onValidated: (config: OpenCodeServerConfig, health: OpenCodeHealthResponse) => void
}) {
  const [formConfig, setFormConfig] = useState(initialConfig)
  const [status, setStatus] = useState<'idle' | 'checking'>('idle')
  const [error, setError] = useState(initialError)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('checking')
    setError(null)

    try {
      const health = await validateOpenCodeConnection(formConfig)
      onValidated(formConfig, health)
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : 'Unable to validate the OpenCode connection.',
      )
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-[480px] rounded-[34px] border border-white/75 bg-white/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_30px_90px_rgba(0,28,64,0.24)] backdrop-blur-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f]">Connect OpenCode</h2>
            <p className="mt-1 text-sm leading-5 text-[#6e6e73]">
              Validate an OpenCode server and cache the connection in this browser.
            </p>
          </div>
          <Button
            className="grid size-8 place-items-center rounded-full text-[#86868b] transition hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]"
            type="button"
            aria-label="Close connection dialog"
            onClick={onClose}
          >
            ×
          </Button>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5 text-sm font-medium text-[#1d1d1f]">
            Server URL
            <input
              className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2.5 text-sm font-normal text-[#1d1d1f] shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)] outline-none backdrop-blur-xl transition focus:border-[#007aff]/50 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
              type="url"
              value={formConfig.baseUrl}
              placeholder="http://127.0.0.1:4096"
              required
              onChange={(event) => setFormConfig({ ...formConfig, baseUrl: event.target.value })}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-[#1d1d1f]">
              Username
              <input
                className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2.5 text-sm font-normal text-[#1d1d1f] shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)] outline-none backdrop-blur-xl transition focus:border-[#007aff]/50 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
                type="text"
                value={formConfig.username}
                placeholder="opencode"
                onChange={(event) => setFormConfig({ ...formConfig, username: event.target.value })}
              />
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-[#1d1d1f]">
              Password
              <input
                className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2.5 text-sm font-normal text-[#1d1d1f] shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)] outline-none backdrop-blur-xl transition focus:border-[#007aff]/50 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
                type="password"
                value={formConfig.password}
                placeholder="Optional"
                onChange={(event) => setFormConfig({ ...formConfig, password: event.target.value })}
              />
            </label>
          </div>

          {error ? (
            <p className="rounded-2xl border border-[#ff3b30]/15 bg-[#ff3b30]/5 px-3 py-2 text-sm leading-5 text-[#b42318]">
              {error}
            </p>
          ) : null}

          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              className="rounded-full border border-white/70 bg-white/65 px-4 py-2 text-sm font-medium text-[#1d1d1f] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_18px_rgba(0,0,0,0.06)] backdrop-blur-xl transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]"
              type="button"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full bg-[#007aff] px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_26px_rgba(0,122,255,0.30)] transition hover:bg-[#0a84ff] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]"
              type="submit"
              disabled={status === 'checking'}
            >
              {status === 'checking' ? 'Checking...' : 'Validate connection'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PrepLane({
  prepSessions,
  activePrepSessionId,
  agents,
  agentError,
  selectedAgent,
  onAgentSelected,
  onCreate,
  onOpen,
}: {
  prepSessions: OpenBoardPrepSession[]
  activePrepSessionId: string | null
  agents: OpenCodeAgent[]
  agentError: string | null
  selectedAgent: string
  onAgentSelected: (agentName: string) => void
  onCreate: () => void
  onOpen: (session: OpenBoardPrepSession) => void
}) {
  return (
    <section className="mb-4 rounded-[32px] border border-white/65 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_18px_48px_rgba(0,64,128,0.10)] backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-[0.95rem] font-semibold tracking-[-0.01em] text-[#1d1d1f]">Prep area</h2>
          <p className="mt-0.5 text-sm text-[#86868b]">
            Planning sessions pinned to their OpenCode projects.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <AreaAgentSelect
            agents={agents}
            areaLabel="Prep"
            error={agentError}
            value={selectedAgent}
            onChange={onAgentSelected}
          />
          <Button
            className="rounded-full bg-[#007aff] px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_26px_rgba(0,122,255,0.30)] transition hover:bg-[#0a84ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]"
            type="button"
            onClick={onCreate}
          >
            Create
          </Button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1" aria-label="Prep sessions">
        {prepSessions.map((session) => (
          <button
            key={session.id}
            className={classNames(
              'min-w-[280px] rounded-[24px] border bg-white/64 px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_24px_rgba(0,64,128,0.08)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/82 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_34px_rgba(0,64,128,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]',
              activePrepSessionId === session.id ? 'border-[#007aff]/45' : 'border-white/70',
            )}
            type="button"
            onClick={() => onOpen(session)}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="rounded-full border border-white/70 bg-white/58 px-2.5 py-1 text-xs font-medium text-[#007aff] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
                {session.status}
              </span>
              <span className="text-xs text-[#86868b]">{formatRelativeTime(session.updatedAt)}</span>
            </div>
            <p className="truncate text-sm font-semibold text-[#1d1d1f]">{session.title}</p>
            <p className="mt-1 truncate text-xs text-[#6e6e73]">{session.projectDirectory}</p>
          </button>
        ))}
      </div>
    </section>
  )
}

function PrepSidebar({
  mode,
  session,
  messages,
  events,
  error,
  connected,
  projects,
  projectError,
  onClose,
  onCreate,
  onDelete,
  onPromptSubmit,
}: {
  mode: SidebarState
  session: OpenBoardPrepSession | null
  messages: OpenCodeMessage[]
  events: SessionEvent[]
  error: string | null
  connected: boolean
  projects: OpenCodeProject[]
  projectError: string | null
  onClose: () => void
  onCreate: (input: { title: string; projectDirectory: string }) => Promise<void>
  onDelete: (session: OpenBoardPrepSession) => Promise<void>
  onPromptSubmit: (text: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<'idle' | 'working'>('idle')
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting'>('idle')
  const [localError, setLocalError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const latestEvent = events[0]
  const streamLabel = latestEvent ? `${latestEvent.type} ${formatRelativeTime(latestEvent.at)}` : 'Listening'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, status, localError, error])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!draft.trim()) {
      return
    }

    setStatus('working')
    setLocalError(null)

    try {
      await onPromptSubmit(draft.trim())
      setDraft('')
    } catch (submitError) {
      setLocalError(submitError instanceof Error ? submitError.message : 'Unable to send message.')
    } finally {
      setStatus('idle')
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  async function handleDelete() {
    if (!session) {
      return
    }

    const confirmed = window.confirm(`Delete “${session.title}” from OpenBoard and OpenCode?`)

    if (!confirmed) {
      return
    }

    setDeleteStatus('deleting')
    setLocalError(null)

    try {
      await onDelete(session)
    } catch (deleteError) {
      setLocalError(deleteError instanceof Error ? deleteError.message : 'Unable to delete prep session.')
      setDeleteStatus('idle')
    }
  }

  return (
    <aside className="fixed inset-x-3 bottom-3 top-3 z-40 flex w-auto flex-col overflow-hidden rounded-[34px] border border-white/55 bg-white/36 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_30px_90px_rgba(0,28,64,0.28)] backdrop-blur-[34px] backdrop-saturate-150 sm:inset-x-auto sm:right-4 sm:w-[min(500px,calc(100vw-2rem))] 2xl:right-6">
      <header className="border-b border-white/45 bg-white/38 px-5 py-4 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#86868b]">Prep chat</p>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f]">
              {mode === 'new' ? 'Create OpenCode session' : session?.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {mode === 'open' ? (
              <details className="group relative">
                <summary className="grid size-8 cursor-pointer list-none place-items-center rounded-full text-[#86868b] transition hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff] [&::-webkit-details-marker]:hidden" aria-label="Prep session options">
                  <span className="text-xl leading-none">…</span>
                </summary>
                <div className="absolute right-0 top-10 z-10 w-[min(20rem,calc(100vw-3rem))] overflow-hidden rounded-[24px] border border-white/70 bg-white/90 p-3 shadow-[0_18px_50px_rgba(0,28,64,0.18)] backdrop-blur-2xl">
                  <div className="grid gap-2 text-sm">
                    <OptionDetail label="Project" value={session?.projectDirectory ?? 'No project'} />
                    <OptionDetail label="OpenCode ID" value={session?.opencodeSessionId ?? 'No session'} />
                    <OptionDetail label="Stream" value={streamLabel} />
                  </div>
                  <Button
                    className="mt-3 w-full rounded-full border border-[#ff3b30]/15 bg-[#ff3b30]/5 px-3 py-2 text-sm font-semibold text-[#b42318] transition hover:bg-[#ff3b30]/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff3b30]"
                    type="button"
                    disabled={deleteStatus === 'deleting'}
                    onClick={handleDelete}
                  >
                    {deleteStatus === 'deleting' ? 'Deleting...' : 'Delete prep session'}
                  </Button>
                </div>
              </details>
            ) : null}
            <Button
              className="grid size-8 place-items-center rounded-full text-[#86868b] transition hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]"
              type="button"
              aria-label="Close prep chat"
              onClick={onClose}
            >
              ×
            </Button>
          </div>
        </div>
      </header>

      {mode === 'new' ? (
        <CreatePrepSessionForm
          connected={connected}
          projects={projects}
          projectError={projectError}
          onCreate={onCreate}
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto bg-white/[0.08] px-4 py-4">
            <MessageList messages={messages} busy={status === 'working'} />
            <div ref={bottomRef} />
          </div>

          <form className="border-t border-white/45 bg-white/42 p-4 backdrop-blur-2xl backdrop-saturate-150" onSubmit={handleSubmit}>
            {(error || localError) && (
              <p className="mb-3 rounded-2xl border border-[#ff3b30]/15 bg-[#ff3b30]/5 px-3 py-2 text-sm leading-5 text-[#b42318]">
                {localError ?? error}
              </p>
            )}
            <textarea
              className="min-h-24 w-full resize-none rounded-[24px] border border-black/10 bg-white px-4 py-3 text-sm leading-5 text-[#1d1d1f] shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] outline-none transition focus:border-[#007aff]/50 focus:ring-4 focus:ring-[#007aff]/10"
              value={draft}
              placeholder="Prep the session: goals, repo context, files to inspect, constraints, and acceptance criteria..."
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-[#86868b]">Enter sends. Shift Enter adds a line.</p>
              <Button
                className="rounded-full bg-[#007aff] px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_26px_rgba(0,122,255,0.30)] transition hover:bg-[#0a84ff] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]"
                type="submit"
                disabled={status === 'working' || !draft.trim()}
              >
                {status === 'working' ? 'Sending...' : 'Send to OpenCode'}
              </Button>
            </div>
          </form>
        </>
      )}
    </aside>
  )
}

function CreatePrepSessionForm({
  connected,
  projects,
  projectError,
  onCreate,
}: {
  connected: boolean
  projects: OpenCodeProject[]
  projectError: string | null
  onCreate: (input: { title: string; projectDirectory: string }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [projectDirectory, setProjectDirectory] = useState('')
  const [manualEntry, setManualEntry] = useState(false)
  const [status, setStatus] = useState<'idle' | 'creating'>('idle')
  const [error, setError] = useState<string | null>(null)
  const sortedProjects = [...projects].sort((a, b) => projectLabel(a).localeCompare(projectLabel(b)))
  const canPickProjects = sortedProjects.length > 0 && !manualEntry

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('creating')
    setError(null)

    try {
      await onCreate({ title, projectDirectory })
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create prep session.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <form className="grid gap-4 p-5" onSubmit={handleSubmit}>
      {!connected ? (
        <p className="rounded-2xl border border-[#ffcc00]/20 bg-[#ffcc00]/10 px-3 py-2 text-sm leading-5 text-[#6e5b00]">
          Connect to OpenCode before creating a prep session.
        </p>
      ) : null}
      <label className="grid gap-1.5 text-sm font-medium text-[#1d1d1f]">
        Session title
        <input
          className="rounded-2xl border border-white/70 bg-white/64 px-3 py-2.5 text-sm font-normal text-[#1d1d1f] shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)] outline-none backdrop-blur-xl transition focus:border-[#007aff]/50 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
          value={title}
          placeholder="Plan settings refactor"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-[#1d1d1f]">
        Project directory
        {canPickProjects ? (
          <div className="grid max-h-[300px] gap-2 overflow-y-auto rounded-[24px] border border-white/70 bg-white/45 p-2 shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)] backdrop-blur-xl">
            {sortedProjects.map((project) => {
              const selected = projectDirectory === project.worktree

              return (
                <button
                  key={project.id}
                  className={classNames(
                    'rounded-[18px] border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]',
                    selected
                      ? 'border-[#007aff]/40 bg-[#eaf4ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
                      : 'border-white/60 bg-white/58 hover:bg-white/82',
                  )}
                  type="button"
                  onClick={() => setProjectDirectory(project.worktree)}
                >
                  <span className="block truncate text-sm font-semibold text-[#1d1d1f]">{projectLabel(project)}</span>
                  <span className="mt-1 block break-all text-xs font-normal leading-4 text-[#6e6e73]">
                    {project.worktree}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <input
            className="rounded-2xl border border-white/70 bg-white/64 px-3 py-2.5 text-sm font-normal text-[#1d1d1f] shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)] outline-none backdrop-blur-xl transition focus:border-[#007aff]/50 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
            value={projectDirectory}
            placeholder="/Users/mininic/openboard"
            required
            onChange={(event) => setProjectDirectory(event.target.value)}
          />
        )}
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#86868b]">
          {projectError ?? (sortedProjects.length > 0 ? `${sortedProjects.length} OpenCode projects loaded.` : 'No OpenCode projects found yet.')}
        </p>
        <Button
          className="rounded-full border border-white/70 bg-white/65 px-3 py-1.5 text-xs font-semibold text-[#007aff] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]"
          type="button"
          onClick={() => {
            setProjectDirectory('')
            setManualEntry((value) => !value)
          }}
        >
          {canPickProjects ? 'Enter path manually' : 'Pick from projects'}
        </Button>
      </div>
      {error ? (
        <p className="rounded-2xl border border-[#ff3b30]/15 bg-[#ff3b30]/5 px-3 py-2 text-sm leading-5 text-[#b42318]">
          {error}
        </p>
      ) : null}
      <Button
        className="justify-self-end rounded-full bg-[#007aff] px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_26px_rgba(0,122,255,0.30)] transition hover:bg-[#0a84ff] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]"
        type="submit"
        disabled={!connected || status === 'creating' || !projectDirectory.trim()}
      >
        {status === 'creating' ? 'Creating...' : 'Create session'}
      </Button>
    </form>
  )
}

function OptionDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/[0.035] px-3 py-2">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[#86868b]">{label}</p>
      <p className="mt-1 break-all text-xs font-medium leading-4 text-[#1d1d1f]">{value}</p>
    </div>
  )
}

function AreaAgentSelect({
  agents,
  areaLabel,
  error,
  value,
  onChange,
}: {
  agents: OpenCodeAgent[]
  areaLabel: string
  error?: string | null
  value: string
  onChange: (agentName: string) => void
}) {
  const agentOptions = normalizedAgentOptions(agents)

  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/58 px-2.5 py-1.5 text-xs font-medium text-[#6e6e73] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl">
      <span className="sr-only">Agent for {areaLabel}</span>
      <span aria-hidden="true">Agent</span>
      <select
        className="max-w-28 bg-transparent text-xs font-semibold text-[#007aff] outline-none"
        value={value}
        title={error ?? `Agent for ${areaLabel}`}
        onChange={(event) => onChange(event.target.value)}
      >
        {agentOptions.map((agent) => (
          <option key={agent.name} value={agent.name}>
            {displayAgentName(agent.name)}
          </option>
        ))}
      </select>
    </label>
  )
}

function MessageList({ messages, busy }: { messages: OpenCodeMessage[]; busy: boolean }) {
  if (messages.length === 0) {
    return (
      <div className="mx-auto mt-2 max-w-[360px] rounded-[24px] bg-black/[0.045] px-4 py-3 text-center">
        <p className="text-sm font-semibold text-[#1d1d1f]">Prep before delegating</p>
        <p className="mt-1 text-sm leading-5 text-[#6e6e73]">
          Clarify scope, gather constraints, and identify the project context here. Once the thread is ready,
          delegate concrete work to the agent cards below.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {messages.map((message) => (
        <MessageBubble key={message.info.id} message={message} />
      ))}
      {busy ? <TypingIndicator /> : null}
    </div>
  )
}

function MessageBubble({ message }: { message: OpenCodeMessage }) {
  const user = message.info.role === 'user'
  const errorText = formatMessageError(message.info.error)

  return (
    <div className={classNames('flex', user ? 'justify-end' : 'justify-start')}>
      <article
        className={classNames(
          user
            ? 'max-w-[78%] rounded-[22px] rounded-br-md bg-[#007aff] px-4 py-2.5 text-white shadow-[0_8px_20px_rgba(0,122,255,0.22)]'
            : 'w-full px-1 py-1 text-[#1d1d1f]',
        )}
      >
        <div className={classNames('mb-1.5 flex items-center justify-between gap-3', user && 'hidden')}>
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={classNames(
                'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
                user ? 'bg-white/20 text-white' : 'bg-[#1d1d1f] text-white',
              )}
            >
              {user ? 'You' : 'OC'}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#86868b]">
                {user ? 'You' : message.info.agent || 'OpenCode'}
              </p>
              {!user && message.info.model ? (
                <p className="truncate text-xs text-[#86868b]">
                  {message.info.model.providerID}/{message.info.model.modelID}
                </p>
              ) : null}
            </div>
          </div>
          {message.info.time?.created ? (
            <p className="shrink-0 text-xs text-[#86868b]">{formatRelativeTime(message.info.time.created)}</p>
          ) : null}
        </div>

        <div className={classNames('grid gap-2 text-sm leading-5', user ? 'text-white' : 'text-[#1d1d1f]')}>
          {errorText ? <MessageError text={errorText} /> : null}
          {message.parts.length > 0 ? (
            message.parts.map((part) => <MessagePart key={part.id} part={part} />)
          ) : !errorText ? (
            <p className={classNames(user ? 'text-white/70' : 'text-[#86868b]')}>Message metadata received.</p>
          ) : null}
        </div>
        {user && message.info.time?.created ? (
          <p className="mt-1 text-right text-[0.68rem] text-white/70">{formatRelativeTime(message.info.time.created)}</p>
        ) : null}
      </article>
    </div>
  )
}

function MessagePart({ part }: { part: OpenCodeMessagePart }) {
  if (part.type === 'text' && part.text) {
    return <p className="whitespace-pre-wrap">{part.text}</p>
  }

  if (part.type === 'file') {
    return (
      <div className="rounded-2xl border border-black/5 bg-white/70 px-3 py-2 text-[#1d1d1f]">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#86868b]">File</p>
        <p className="mt-1 truncate text-sm font-medium text-[#1d1d1f]">{part.filename ?? part.url ?? 'Attachment'}</p>
      </div>
    )
  }

  if (part.type === 'tool') {
    return (
      <div className="rounded-2xl border border-black/5 bg-white/70 px-3 py-2 text-[#1d1d1f]">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#86868b]">Tool</p>
        <p className="mt-1 text-sm font-medium text-[#1d1d1f]">{part.tool ?? part.state?.title ?? 'Tool call'}</p>
        {part.state?.status ? <p className="mt-1 text-xs text-[#86868b]">{part.state.status}</p> : null}
      </div>
    )
  }

  return <p className="rounded-2xl bg-black/[0.035] px-3 py-2 text-[#6e6e73]">{part.type}</p>
}

function MessageError({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[#ff3b30]/15 bg-[#ff3b30]/5 px-3 py-2 text-[#b42318]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em]">OpenCode error</p>
      <p className="mt-1 whitespace-pre-wrap">{text}</p>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="inline-flex items-center gap-2 rounded-full bg-black/[0.045] px-3 py-2 text-sm text-[#6e6e73]">
        <span className="size-2 animate-pulse rounded-full bg-[#007aff]" />
        Waiting for OpenCode
      </div>
    </div>
  )
}

function formatMessageError(error: unknown) {
  if (!error) {
    return null
  }

  if (typeof error === 'string') {
    return error
  }

  if (typeof error === 'object' && error !== null) {
    const data = 'data' in error ? error.data : undefined

    if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
      return data.message
    }

    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }
  }

  return 'OpenCode returned an error for this message.'
}

function KanbanColumn({
  column,
  cards,
  agents,
  selectedAgent,
  onAgentSelected,
}: {
  column: Column
  cards: Card[]
  agents: OpenCodeAgent[]
  selectedAgent: string
  onAgentSelected: (agentName: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const cardIds = useMemo(() => cards.map((card) => card.id), [cards])

  return (
    <article
      className={classNames(
        'min-h-[560px] rounded-[32px] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_18px_46px_rgba(0,64,128,0.08)] backdrop-blur-2xl transition-colors',
        isOver ? 'border-[#007aff]/45 bg-[#eaf4ff]/78' : 'border-white/65 bg-white/42',
      )}
      ref={setNodeRef}
    >
      <header className="mb-3 flex items-start justify-between gap-4 px-1 py-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[0.95rem] font-semibold tracking-[-0.01em] text-[#1d1d1f]">
              {column.title}
            </h2>
            <span className="grid size-6 place-items-center rounded-full border border-white/70 bg-white/58 text-[0.7rem] font-medium text-[#007aff] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl">
              {cards.length}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-[#86868b]">{column.description}</p>
        </div>
        <AreaAgentSelect
          agents={agents}
          areaLabel={column.title}
          value={selectedAgent}
          onChange={onAgentSelected}
        />
      </header>

      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        <div className="grid min-h-[460px] content-start gap-2.5">
          {cards.map((card) => (
            <SortableTaskCard key={card.id} card={card} />
          ))}
          {cards.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/70 bg-white/28 px-4 py-6 text-center text-sm leading-5 text-[#86868b] backdrop-blur-xl">
              Drop work here when it is ready for {displayAgentName(selectedAgent)}.
            </div>
          ) : null}
        </div>
      </SortableContext>
    </article>
  )
}

function SortableTaskCard({ card }: { card: Card }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id })

  return (
    <TaskCard
      card={card}
      dragHandleProps={{ ...attributes, ...listeners }}
      refCallback={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      hidden={isDragging}
    />
  )
}

function TaskCard({
  card,
  overlay = false,
  hidden = false,
  refCallback,
  style,
  dragHandleProps,
}: {
  card: Card
  overlay?: boolean
  hidden?: boolean
  refCallback?: (element: HTMLDivElement | null) => void
  style?: CSSProperties
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>
}) {
  return (
    <div
      className={classNames(
        'group rounded-[24px] border border-white/72 bg-white/68 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_14px_34px_rgba(0,64,128,0.10)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/84 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_44px_rgba(0,64,128,0.14)]',
        overlay && 'w-[290px] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_24px_70px_rgba(0,64,128,0.20)]',
        hidden && 'opacity-30',
      )}
      ref={refCallback}
      style={style}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="rounded-full border border-[#007aff]/12 bg-[#eaf4ff]/72 px-2.5 py-1 text-xs font-medium text-[#0066d6] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
          {card.agent}
        </span>
        <Button
          className="grid size-8 cursor-grab place-items-center rounded-full text-[#86868b] transition hover:bg-black/[0.04] active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]"
          type="button"
          aria-label={`Move ${card.title}`}
          {...dragHandleProps}
        >
          <span className="flex flex-col gap-1">
            <span className="block h-0.5 w-3 rounded-full bg-current" />
            <span className="block h-0.5 w-3 rounded-full bg-current" />
          </span>
        </Button>
      </div>
      <h3 className="text-[0.96rem] font-semibold leading-snug tracking-[-0.01em] text-[#1d1d1f]">
        {card.title}
      </h3>
      <p className="mt-2 text-sm leading-5 text-[#6e6e73]">{card.prompt}</p>
    </div>
  )
}

function classNames(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function getConnectionLabel(connection: ConnectionState) {
  if (connection.status === 'checking') {
    return 'Checking OpenCode'
  }

  if (connection.status === 'connected') {
    return connection.config ? new URL(connection.config.baseUrl).host : 'OpenCode connected'
  }

  if (connection.status === 'failed') {
    return 'OpenCode unavailable'
  }

  return 'Not connected'
}

function getConnectionDotColor(status: ConnectionState['status']) {
  if (status === 'connected') {
    return 'bg-[#34c759]'
  }

  if (status === 'checking') {
    return 'bg-[#ffcc00]'
  }

  if (status === 'failed') {
    return 'bg-[#ff3b30]'
  }

  return 'bg-[#86868b]'
}

function loadAgentSelections() {
  const storedValue = localStorage.getItem(agentSelectionsStorageKey)

  if (!storedValue) {
    return defaultAgentSelections
  }

  try {
    return { ...defaultAgentSelections, ...JSON.parse(storedValue) } as AreaAgentSelections
  } catch {
    return defaultAgentSelections
  }
}

function saveAgentSelections(selections: AreaAgentSelections) {
  localStorage.setItem(agentSelectionsStorageKey, JSON.stringify(selections))
}

function normalizedAgentOptions(agents: OpenCodeAgent[]) {
  const map = new Map<string, OpenCodeAgent>()

  agents.forEach((agent) => map.set(agent.name, agent))
  Object.values(defaultAgentSelections).forEach((agentName) => {
    if (!map.has(agentName)) {
      map.set(agentName, { name: agentName, mode: 'all' })
    }
  })

  return Array.from(map.values()).sort((a, b) => displayAgentName(a.name).localeCompare(displayAgentName(b.name)))
}

function selectedAgentName(agentName: string, agents: OpenCodeAgent[]) {
  return normalizedAgentOptions(agents).some((agent) => agent.name === agentName) ? agentName : 'build'
}

function displayAgentName(agentName: string) {
  return agentName
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatRelativeTime(timestamp: number) {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000))

  if (seconds < 60) {
    return 'just now'
  }

  const minutes = Math.round(seconds / 60)

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.round(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function projectLabel(project: OpenCodeProject) {
  if (project.name?.trim()) {
    return project.name.trim()
  }

  const parts = project.worktree.split('/').filter(Boolean)
  return parts.at(-1) ?? project.worktree
}

export default App
