import { Button } from '@base-ui/react/button'
import type { DragEvent } from 'react'
import type { OpenCodeAgent } from '../../opencodeClient'
import type { OpenBoardPrepSession } from '../../openboardDb'
import { fallbackAgentSelections } from '../../app/config'
import { classNames } from '../../app/utils'
import { useSessionPreview, useSessionPreviewLoading } from '../../messageStreamStore'
import { AreaAgentSelect } from '../agents/AreaAgentSelect'

export function PrepLane({
  prepSessions,
  activePrepSessionId,
  busySessionIds,
  agents,
  agentError,
  selectedAgent,
  onAgentSelected,
  onCreate,
  onConfigure,
  onOpen,
  onTicketDragStart,
}: {
  prepSessions: OpenBoardPrepSession[]
  activePrepSessionId: string | null
  busySessionIds: Set<string>
  agents: OpenCodeAgent[]
  agentError: string | null
  selectedAgent: string
  onAgentSelected: (agentName: string) => void
  onCreate: () => void
  onConfigure: () => void
  onOpen: (session: OpenBoardPrepSession) => void
  onTicketDragStart: (event: DragEvent<HTMLButtonElement>, session: OpenBoardPrepSession) => void
}) {
  return (
    <section className="ob-surface mb-4 rounded-[32px] p-3 backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="ob-text text-[0.95rem] font-semibold tracking-[-0.01em]">Prep area</h2>
          <p className="ob-muted mt-0.5 text-sm">Planning sessions pinned to their OpenCode projects.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button className="ob-icon-button grid size-8 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2" type="button" aria-label="Configure Prep" title="Configure Prep" onClick={onConfigure}>
            <span aria-hidden="true">&#9881;</span>
          </Button>
          <AreaAgentSelect
            agents={agents}
            areaLabel="Prep"
            error={agentError}
            value={selectedAgent}
            fallbackValue={fallbackAgentSelections.prep}
            onChange={onAgentSelected}
          />
          <Button className="ob-primary rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2" type="button" onClick={onCreate}>
            Create
          </Button>
        </div>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 py-1.5" aria-label="Prep sessions">
        {prepSessions.map((session) => (
          <button
            key={session.id}
            className={classNames(
              'ob-card w-[280px] max-w-[280px] shrink-0 rounded-[24px] px-4 py-3 text-left backdrop-blur-xl transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2',
              activePrepSessionId === session.id && 'ob-card-active',
            )}
            type="button"
            draggable
            onDragStart={(event) => onTicketDragStart(event, session)}
            onClick={() => onOpen(session)}
          >
            <div className="flex items-start gap-2">
              {busySessionIds.has(session.id) ? <BusyDot /> : null}
              <p className="ob-text min-w-0 truncate text-sm font-semibold">{session.title}</p>
            </div>
            <SessionPreview sessionId={session.id} />
          </button>
        ))}
      </div>
    </section>
  )
}

function BusyDot() {
  return <span className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full bg-[var(--ob-primary)] shadow-[0_0_0_3px_rgb(0_122_255_/_0.12)]" aria-label="Chat is busy" />
}

function SessionPreview({ sessionId }: { sessionId: string }) {
  const preview = useSessionPreview(sessionId)
  const loading = useSessionPreviewLoading(sessionId)

  return <p className="ob-muted mt-1 line-clamp-2 min-h-8 break-words text-xs leading-4">{loading && !preview ? 'Loading conversation...' : preview || 'No AI response yet.'}</p>
}
