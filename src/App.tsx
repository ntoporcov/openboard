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
  clearOpenCodeServerConfig,
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

type AppearanceTheme = 'cupertino' | 'opencode'
type AppearanceMode = 'light' | 'dark' | 'system'

type AppearanceSettings = {
  theme: AppearanceTheme
  mode: AppearanceMode
}

const appearanceStorageKey = 'openboard.appearance.v1'

const defaultAppearanceSettings: AppearanceSettings = {
  theme: 'cupertino',
  mode: 'system',
}

function App() {
  const [cards, setCards] = useState(initialCards)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [connectionModalOpen, setConnectionModalOpen] = useState(() => !loadOpenCodeServerConfig())
  const [pluginModalOpen, setPluginModalOpen] = useState(false)
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

  function handleDisconnect() {
    clearOpenCodeServerConfig()
    setConnection({
      config: null,
      health: null,
      status: 'idle',
      error: null,
    })
    setProjects([])
    setAgents([])
    setProjectError(null)
    setAgentError(null)
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

  function handleAppearanceChange(nextAppearance: Partial<AppearanceSettings>) {
    setAppearance((currentAppearance) => {
      const updatedAppearance = { ...currentAppearance, ...nextAppearance }
      saveAppearanceSettings(updatedAppearance)
      return updatedAppearance
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

    let submittedMessage: OpenCodeMessage | null = null

    try {
      submittedMessage = await sendOpenCodePrompt(connection.config, {
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

    if (submittedMessage) {
      setMessages((currentMessages) => mergeMessages(currentMessages, [submittedMessage]))
    }

    try {
      const nextMessages = await listOpenCodeMessages(connection.config, {
        sessionID: activePrepSession.opencodeSessionId,
        directory: activePrepSession.projectDirectory,
      })
      setMessages((currentMessages) => mergeMessages(currentMessages, nextMessages))
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Unable to refresh OpenCode messages.')
    }
  }

  const connectionLabel = getConnectionLabel(connection)

  return (
    <main className="openboard-app relative min-h-svh min-w-max" data-mode={appearance.mode} data-theme={appearance.theme}>
      <div className="ob-backdrop pointer-events-none absolute inset-0" />
      <div className="ob-glow pointer-events-none absolute left-1/2 top-6 h-28 w-[min(760px,80vw)] -translate-x-1/2 rounded-full blur-3xl" />
      <div
        className="relative flex min-h-svh w-full flex-col py-4"
      >
        <div
          className={classNames(
            'sticky left-0 right-0 z-20 w-screen px-4 transition-[width] duration-300 sm:px-6 lg:px-8',
            sidebarState !== 'closed' && '2xl:right-[548px] 2xl:w-[calc(100vw-548px)]',
          )}
        >
          <header className="ob-surface mb-4 flex flex-col gap-3 rounded-[32px] px-4 py-3 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="ob-logo grid size-10 place-items-center rounded-[18px] text-sm font-semibold text-white">
                OB
              </div>
              <div>
                <h1 className="ob-text text-[1.05rem] font-semibold tracking-[-0.02em]">
                  OpenBoard
                </h1>
                <p className="ob-muted text-sm">Kanban for AI coding work</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <AppearanceControls appearance={appearance} onChange={handleAppearanceChange} />
              <span className="ob-pill inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-sm backdrop-blur-xl">
                <button
                  className="inline-flex items-center gap-2 px-1 outline-none"
                  type="button"
                  onClick={() => setConnectionModalOpen(true)}
                >
                  <span className={classNames('size-2 rounded-full', getConnectionDotColor(connection.status))} />
                  {connectionLabel}
                </button>
                {connection.config ? (
                  <Button
                    className="ob-icon-button grid size-5 place-items-center rounded-full text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2"
                    type="button"
                    aria-label="Disconnect OpenCode"
                    title="Disconnect OpenCode"
                    onClick={handleDisconnect}
                  >
                    ×
                  </Button>
                ) : null}
              </span>
              <Button
                className="ob-secondary-button rounded-full px-4 py-2 text-sm font-medium backdrop-blur-xl transition focus-visible:outline-2 focus-visible:outline-offset-2"
                type="button"
                onClick={() => setPluginModalOpen(true)}
              >
                Plugin
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

      {pluginModalOpen ? <PluginModal onClose={() => setPluginModalOpen(false)} /> : null}

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

function PluginModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6 backdrop-blur-sm">
      <div className="ob-surface w-full max-w-[640px] rounded-[34px] p-5 backdrop-blur-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="ob-accent text-xs font-semibold uppercase tracking-[0.16em]">Recommended setup</p>
            <h2 className="ob-text mt-1 text-lg font-semibold tracking-[-0.02em]">Install the OpenBoard plugin</h2>
            <p className="ob-muted mt-1 text-sm leading-5">
              The plugin adds the Prepper, Planner, Builder, Reviewer, and Tester agents plus board handoff tools.
            </p>
          </div>
          <Button
            className="ob-icon-button grid size-8 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2"
            type="button"
            aria-label="Close plugin instructions"
            onClick={onClose}
          >
            ×
          </Button>
        </div>

        <div className="grid gap-3 text-sm">
          <p className="ob-muted leading-5">
            Add the GitHub Packages registry for the package scope, then add the plugin to your OpenCode config.
            If you use the hosted app, start OpenCode with CORS enabled for GitHub Pages.
          </p>
          <CodePill value="@ntoporcov:registry=https://npm.pkg.github.com" />
          <CodePill value={'"plugin": ["@ntoporcov/openboard-opencode-plugin"]'} />
          <CodePill value="opencode serve --cors https://ntoporcov.github.io" />
        </div>
      </div>
    </div>
  )
}

function CodePill({ value }: { value: string }) {
  return (
    <code className="ob-card rounded-2xl px-3 py-2 font-mono text-xs leading-5">
      {value}
    </code>
  )
}

function AppearanceControls({
  appearance,
  onChange,
}: {
  appearance: AppearanceSettings
  onChange: (nextAppearance: Partial<AppearanceSettings>) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="ob-pill inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-medium backdrop-blur-xl">
        <span className="sr-only">Theme</span>
        <span aria-hidden="true">Theme</span>
        <select
          className="ob-select max-w-28 bg-transparent text-xs font-semibold outline-none"
          value={appearance.theme}
          onChange={(event) => onChange({ theme: event.target.value as AppearanceTheme })}
        >
          <option value="cupertino">Cupertino</option>
          <option value="opencode">OpenCode</option>
        </select>
      </label>
      <label className="ob-pill inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-medium backdrop-blur-xl">
        <span className="sr-only">Mode</span>
        <span aria-hidden="true">Mode</span>
        <select
          className="ob-select max-w-24 bg-transparent text-xs font-semibold outline-none"
          value={appearance.mode}
          onChange={(event) => onChange({ mode: event.target.value as AppearanceMode })}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </div>
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
      <div className="ob-surface w-full max-w-[480px] rounded-[34px] p-5 backdrop-blur-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="ob-text text-lg font-semibold tracking-[-0.02em]">Connect OpenCode</h2>
            <p className="ob-muted mt-1 text-sm leading-5">
              Validate an OpenCode server and cache the connection in this browser.
            </p>
          </div>
          <Button
            className="ob-icon-button grid size-8 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2"
            type="button"
            aria-label="Close connection dialog"
            onClick={onClose}
          >
            ×
          </Button>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="ob-text grid gap-1.5 text-sm font-medium">
            Server URL
            <input
              className="ob-input rounded-2xl px-3 py-2.5 text-sm font-normal outline-none backdrop-blur-xl transition"
              type="url"
              value={formConfig.baseUrl}
              placeholder="http://127.0.0.1:4096"
              required
              onChange={(event) => setFormConfig({ ...formConfig, baseUrl: event.target.value })}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="ob-text grid gap-1.5 text-sm font-medium">
              Username
              <input
                className="ob-input rounded-2xl px-3 py-2.5 text-sm font-normal outline-none backdrop-blur-xl transition"
                type="text"
                value={formConfig.username}
                placeholder="opencode"
                onChange={(event) => setFormConfig({ ...formConfig, username: event.target.value })}
              />
            </label>

            <label className="ob-text grid gap-1.5 text-sm font-medium">
              Password
              <input
                className="ob-input rounded-2xl px-3 py-2.5 text-sm font-normal outline-none backdrop-blur-xl transition"
                type="password"
                value={formConfig.password}
                placeholder="Optional"
                onChange={(event) => setFormConfig({ ...formConfig, password: event.target.value })}
              />
            </label>
          </div>

          {error ? (
            <p className="ob-danger rounded-2xl px-3 py-2 text-sm leading-5">
              {error}
            </p>
          ) : null}

          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              className="ob-secondary-button rounded-full px-4 py-2 text-sm font-medium backdrop-blur-xl transition focus-visible:outline-2 focus-visible:outline-offset-2"
              type="button"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="ob-primary rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
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
    <section className="ob-surface mb-4 rounded-[32px] p-3 backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="ob-text text-[0.95rem] font-semibold tracking-[-0.01em]">Prep area</h2>
          <p className="ob-muted mt-0.5 text-sm">
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
            className="ob-primary rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2"
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
              'ob-card min-w-[280px] rounded-[24px] px-4 py-3 text-left backdrop-blur-xl transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2',
              activePrepSessionId === session.id && 'ob-card-active',
            )}
            type="button"
            onClick={() => onOpen(session)}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="ob-pill ob-accent rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-xl">
                {session.status}
              </span>
              <span className="ob-muted text-xs">{formatRelativeTime(session.updatedAt)}</span>
            </div>
            <p className="ob-text truncate text-sm font-semibold">{session.title}</p>
            <p className="ob-muted mt-1 truncate text-xs">{session.projectDirectory}</p>
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
    <aside className="ob-sidebar fixed inset-x-3 bottom-3 top-3 z-40 flex w-auto flex-col overflow-hidden rounded-[34px] backdrop-blur-[34px] backdrop-saturate-150 sm:inset-x-auto sm:right-4 sm:w-[min(500px,calc(100vw-2rem))] 2xl:right-6">
      <header className="ob-sidebar-header px-5 py-4 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="ob-muted text-xs font-medium uppercase tracking-[0.12em]">Prep chat</p>
            <h2 className="ob-text mt-1 truncate text-lg font-semibold tracking-[-0.02em]">
              {mode === 'new' ? 'Create OpenCode session' : session?.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {mode === 'open' ? (
              <details className="group relative">
                <summary className="ob-icon-button grid size-8 cursor-pointer list-none place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden" aria-label="Prep session options">
                  <span className="text-xl leading-none">…</span>
                </summary>
                <div className="ob-menu absolute right-0 top-10 z-10 w-[min(20rem,calc(100vw-3rem))] overflow-hidden rounded-[24px] p-3 backdrop-blur-2xl">
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
              className="ob-icon-button grid size-8 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2"
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
          <div className="ob-chat flex-1 overflow-y-auto px-4 py-4">
            <MessageList messages={messages} busy={status === 'working'} />
            <div ref={bottomRef} />
          </div>

          <form className="ob-sidebar-footer p-4 backdrop-blur-2xl backdrop-saturate-150" onSubmit={handleSubmit}>
            {(error || localError) && (
              <p className="ob-danger mb-3 rounded-2xl px-3 py-2 text-sm leading-5">
                {localError ?? error}
              </p>
            )}
            <textarea
              className="ob-input min-h-24 w-full resize-none rounded-[24px] px-4 py-3 text-sm leading-5 outline-none transition"
              value={draft}
              placeholder="Prep the session: goals, repo context, files to inspect, constraints, and acceptance criteria..."
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="ob-muted text-xs">Enter sends. Shift Enter adds a line.</p>
              <Button
                className="ob-primary rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
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
        <p className="ob-warning rounded-2xl px-3 py-2 text-sm leading-5">
          Connect to OpenCode before creating a prep session.
        </p>
      ) : null}
      <label className="ob-text grid gap-1.5 text-sm font-medium">
        Session title
        <input
          className="ob-input rounded-2xl px-3 py-2.5 text-sm font-normal outline-none backdrop-blur-xl transition"
          value={title}
          placeholder="Plan settings refactor"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="ob-text grid gap-1.5 text-sm font-medium">
        Project directory
        {canPickProjects ? (
          <div className="ob-card grid max-h-[300px] gap-2 overflow-y-auto rounded-[24px] p-2 backdrop-blur-xl">
            {sortedProjects.map((project) => {
              const selected = projectDirectory === project.worktree

              return (
                <button
                  key={project.id}
                  className={classNames(
                    'rounded-[18px] px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2',
                    selected
                      ? 'ob-card-active'
                      : 'ob-card',
                  )}
                  type="button"
                  onClick={() => setProjectDirectory(project.worktree)}
                >
                  <span className="ob-text block truncate text-sm font-semibold">{projectLabel(project)}</span>
                  <span className="ob-muted mt-1 block break-all text-xs font-normal leading-4">
                    {project.worktree}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <input
            className="ob-input rounded-2xl px-3 py-2.5 text-sm font-normal outline-none backdrop-blur-xl transition"
            value={projectDirectory}
            placeholder="/Users/mininic/openboard"
            required
            onChange={(event) => setProjectDirectory(event.target.value)}
          />
        )}
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="ob-muted text-xs">
          {projectError ?? (sortedProjects.length > 0 ? `${sortedProjects.length} OpenCode projects loaded.` : 'No OpenCode projects found yet.')}
        </p>
        <Button
          className="ob-secondary-button rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-xl transition focus-visible:outline-2 focus-visible:outline-offset-2"
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
        <p className="ob-danger rounded-2xl px-3 py-2 text-sm leading-5">
          {error}
        </p>
      ) : null}
      <Button
        className="ob-primary justify-self-end rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
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
    <div className="ob-empty rounded-2xl px-3 py-2">
      <p className="ob-muted text-[0.65rem] font-medium uppercase tracking-[0.12em]">{label}</p>
      <p className="ob-text mt-1 break-all text-xs font-medium leading-4">{value}</p>
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
  const [open, setOpen] = useState(false)
  const selectedAgent = agentOptions.find((agent) => agent.name === value) ?? agentOptions[0]
  const selectedLabel = selectedAgent ? displayAgentName(selectedAgent.name) : 'Agent'

  return (
    <div
      className="relative inline-flex"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
        }
      }}
    >
      <Button
        className="ob-pill inline-flex max-w-[11rem] items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-medium backdrop-blur-xl transition focus-visible:outline-2 focus-visible:outline-offset-2"
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        title={error ?? `${areaLabel} agent: ${selectedLabel}`}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        <span className="ob-muted shrink-0" aria-hidden="true">Agent</span>
        <span className="ob-accent min-w-0 truncate font-semibold">{selectedLabel}</span>
        <span className="ob-muted shrink-0 text-[0.65rem]" aria-hidden="true">▾</span>
      </Button>

      {open ? (
        <div
          className="ob-menu absolute right-0 top-[calc(100%+0.35rem)] z-30 grid w-[min(15rem,calc(100vw-2rem))] gap-1 rounded-[18px] p-1.5 text-xs backdrop-blur-2xl"
          role="listbox"
          aria-label={`Agent for ${areaLabel}`}
        >
          {agentOptions.map((agent) => {
            const label = displayAgentName(agent.name)
            const selected = agent.name === value

            return (
              <button
                key={agent.name}
                className={classNames(
                  'flex items-center justify-between gap-3 rounded-[14px] px-2.5 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2',
                  selected ? 'ob-card-active' : 'hover:bg-black/[0.04]',
                )}
                type="button"
                role="option"
                aria-selected={selected}
                title={agent.name}
                onClick={() => {
                  onChange(agent.name)
                  setOpen(false)
                }}
              >
                <span className="min-w-0 truncate font-medium">{label}</span>
                {selected ? <span className="ob-accent shrink-0">✓</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function MessageList({ messages, busy }: { messages: OpenCodeMessage[]; busy: boolean }) {
  if (messages.length === 0) {
    return (
      <div className="ob-empty mx-auto mt-2 max-w-[360px] rounded-[24px] px-4 py-3 text-center">
        <p className="ob-text text-sm font-semibold">Prep before delegating</p>
        <p className="ob-muted mt-1 text-sm leading-5">
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
  const visibleParts = message.parts.filter(isVisibleMessagePart)

  if (!errorText && visibleParts.length === 0 && !user) {
    return null
  }

  return (
    <div className={classNames('flex', user ? 'justify-end' : 'justify-start')}>
      <article
        className={classNames(
          user
            ? 'ob-user-bubble max-w-[78%] rounded-[22px] rounded-br-md px-4 py-2.5'
            : 'ob-text w-full px-1 py-1',
        )}
      >
        <div className={classNames('mb-1.5 flex items-center justify-between gap-3', user && 'hidden')}>
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={classNames(
                'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
                user ? 'bg-white/20 text-white' : 'ob-agent-avatar',
              )}
            >
              {user ? 'You' : 'OC'}
            </span>
            <div className="min-w-0">
              <p className="ob-muted text-xs font-medium uppercase tracking-[0.12em]">
                {user ? 'You' : message.info.agent || 'OpenCode'}
              </p>
              {!user && message.info.model ? (
                <p className="ob-muted truncate text-xs">
                  {message.info.model.providerID}/{message.info.model.modelID}
                </p>
              ) : null}
            </div>
          </div>
          {message.info.time?.created ? (
            <p className="ob-muted shrink-0 text-xs">{formatRelativeTime(message.info.time.created)}</p>
          ) : null}
        </div>

        <div className={classNames('grid gap-2 text-sm leading-5', user ? 'text-white' : 'ob-text')}>
          {errorText ? <MessageError text={errorText} /> : null}
          {visibleParts.length > 0 ? (
            visibleParts.map((part) => <MessagePart key={part.id} part={part} />)
          ) : !errorText ? (
            <p className={classNames(user ? 'text-white/70' : 'ob-muted')}>Message metadata received.</p>
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
      <div className="ob-card rounded-2xl px-3 py-2">
        <p className="ob-muted text-xs font-medium uppercase tracking-[0.12em]">File</p>
        <p className="ob-text mt-1 truncate text-sm font-medium">{part.filename ?? part.url ?? 'Attachment'}</p>
      </div>
    )
  }

  if (part.type === 'tool') {
    return (
      <div className="ob-card rounded-2xl px-3 py-2">
        <p className="ob-muted text-xs font-medium uppercase tracking-[0.12em]">Tool</p>
        <p className="ob-text mt-1 text-sm font-medium">{part.tool ?? part.state?.title ?? 'Tool call'}</p>
        {part.state?.status ? <p className="ob-muted mt-1 text-xs">{part.state.status}</p> : null}
      </div>
    )
  }

  return <p className="ob-empty rounded-2xl px-3 py-2">{part.type}</p>
}

function isVisibleMessagePart(part: OpenCodeMessagePart) {
  return part.type !== 'step-start' && part.type !== 'step-finish'
}

function MessageError({ text }: { text: string }) {
  return (
    <div className="ob-danger rounded-2xl px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em]">OpenCode error</p>
      <p className="mt-1 whitespace-pre-wrap">{text}</p>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="ob-empty inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm">
        <span className="ob-dot size-2 animate-pulse rounded-full" />
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
        'ob-column min-h-[560px] rounded-[32px] p-3 backdrop-blur-2xl transition-colors',
        isOver && 'ob-column-over',
      )}
      ref={setNodeRef}
    >
      <header className="mb-3 flex items-start justify-between gap-4 px-1 py-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="ob-text text-[0.95rem] font-semibold tracking-[-0.01em]">
              {column.title}
            </h2>
            <span className="ob-pill ob-accent grid size-6 place-items-center rounded-full text-[0.7rem] font-medium backdrop-blur-xl">
              {cards.length}
            </span>
          </div>
          <p className="ob-muted mt-0.5 text-sm">{column.description}</p>
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
            <div className="ob-dropzone rounded-[24px] px-4 py-6 text-center text-sm leading-5 backdrop-blur-xl">
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
        'ob-card group rounded-[24px] p-3 backdrop-blur-xl transition hover:-translate-y-0.5',
        overlay && 'w-[290px]',
        hidden && 'opacity-30',
      )}
      ref={refCallback}
      style={style}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="ob-pill ob-accent rounded-full px-2.5 py-1 text-xs font-medium">
          {card.agent}
        </span>
        <Button
          className="ob-icon-button grid size-8 cursor-grab place-items-center rounded-full transition active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2"
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
      <h3 className="ob-text text-[0.96rem] font-semibold leading-snug tracking-[-0.01em]">
        {card.title}
      </h3>
      <p className="ob-muted mt-2 text-sm leading-5">{card.prompt}</p>
    </div>
  )
}

function classNames(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function mergeMessages(currentMessages: OpenCodeMessage[], nextMessages: OpenCodeMessage[]) {
  const messages = new Map(currentMessages.map((message) => [message.info.id, message]))

  nextMessages.forEach((message) => messages.set(message.info.id, message))

  return Array.from(messages.values()).sort((first, second) => {
    const firstCreated = first.info.time?.created ?? 0
    const secondCreated = second.info.time?.created ?? 0

    if (firstCreated !== secondCreated) {
      return firstCreated - secondCreated
    }

    return first.info.id.localeCompare(second.info.id)
  })
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

function loadAppearanceSettings() {
  const storedValue = localStorage.getItem(appearanceStorageKey)

  if (!storedValue) {
    return defaultAppearanceSettings
  }

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

function saveAppearanceSettings(settings: AppearanceSettings) {
  localStorage.setItem(appearanceStorageKey, JSON.stringify(settings))
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
