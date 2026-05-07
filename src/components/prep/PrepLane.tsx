import { Button } from '@base-ui/react/button'
import type { DragEvent } from 'react'
import type { OpenCodeAgent } from '../../opencodeClient'
import type { OpenBoardPrepSession } from '../../openboardDb'
import { fallbackAgentSelections } from '../../app/config'
import { classNames, formatRelativeTime } from '../../app/utils'
import { AreaAgentSelect } from '../agents/AreaAgentSelect'

export function PrepLane({
  prepSessions,
  activePrepSessionId,
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

      <div className="flex gap-3 overflow-x-auto pb-1" aria-label="Prep sessions">
        {prepSessions.map((session) => (
          <button
            key={session.id}
            className={classNames(
              'ob-card min-w-[280px] rounded-[24px] px-4 py-3 text-left backdrop-blur-xl transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2',
              activePrepSessionId === session.id && 'ob-card-active',
            )}
            type="button"
            draggable
            onDragStart={(event) => onTicketDragStart(event, session)}
            onClick={() => onOpen(session)}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="ob-pill ob-accent rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-xl">{session.status}</span>
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
