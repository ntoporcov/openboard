import { Button } from '@base-ui/react/button'
import { Popover } from '@base-ui/react/popover'
import { useState, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react'
import type { OpenCodeAgent, OpenCodeQuestionRequest } from '../../opencodeClient'
import type { OpenBoardPrepSession } from '../../openboardDb'
import { fallbackAgentSelections } from '../../app/config'
import { classNames, type PhaseMarkerStatus } from '../../app/utils'
import { useSessionPhaseStatus, useSessionPreview, useSessionPreviewLoading } from '../../messageStreamStore'
import { AreaAgentSelect } from '../agents/AreaAgentSelect'
import { QuestionRequestCard } from '../chat/ChatMessages'

export function PrepLane({
  prepSessions,
  activePrepSessionId,
  busySessionIds,
  questionsBySessionId,
  questionPendingBySessionId,
  agents,
  agentError,
  selectedAgent,
  onAgentSelected,
  onCreate,
  onConfigure,
  onOpen,
  onQuestionReply,
  onTicketDragStart,
}: {
  prepSessions: OpenBoardPrepSession[]
  activePrepSessionId: string | null
  busySessionIds: Set<string>
  questionsBySessionId: Record<string, OpenCodeQuestionRequest[]>
  questionPendingBySessionId: Record<string, boolean>
  agents: OpenCodeAgent[]
  agentError: string | null
  selectedAgent: string
  onAgentSelected: (agentName: string) => void
  onCreate: () => void
  onConfigure: () => void
  onOpen: (session: OpenBoardPrepSession) => void
  onQuestionReply: (requestID: string, answers: string[][]) => Promise<void>
  onTicketDragStart: (event: DragEvent<HTMLDivElement>, session: OpenBoardPrepSession) => void
}) {
  const [openQuestionSessionId, setOpenQuestionSessionId] = useState<string | null>(null)

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
          <PrepSessionCard
            key={session.id}
            session={session}
            active={activePrepSessionId === session.id}
            busy={busySessionIds.has(session.id)}
            questions={questionsBySessionId[session.id] ?? []}
            questionPending={questionPendingBySessionId[session.id] ?? false}
            questionPopoverOpen={openQuestionSessionId === session.id}
            onOpen={onOpen}
            onQuestionReply={onQuestionReply}
            onQuestionPopoverChange={(open) => setOpenQuestionSessionId(open ? session.id : null)}
            onTicketDragStart={onTicketDragStart}
          />
        ))}
      </div>
    </section>
  )
}

function PrepSessionCard({ session, active, busy, questions, questionPending, questionPopoverOpen, onOpen, onQuestionReply, onQuestionPopoverChange, onTicketDragStart }: { session: OpenBoardPrepSession; active: boolean; busy: boolean; questions: OpenCodeQuestionRequest[]; questionPending: boolean; questionPopoverOpen: boolean; onOpen: (session: OpenBoardPrepSession) => void; onQuestionReply: (requestID: string, answers: string[][]) => Promise<void>; onQuestionPopoverChange: (open: boolean) => void; onTicketDragStart: (event: DragEvent<HTMLDivElement>, session: OpenBoardPrepSession) => void }) {
  const pendingQuestion = questions[0]
  const hasPendingQuestion = !!pendingQuestion || questionPending
  const phaseStatus = useSessionPhaseStatus(session.id, 'prep')

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onOpen(session)
  }

  function stopCardInteraction(event: PointerEvent<HTMLElement>) {
    event.stopPropagation()
  }

  return (
    <div
      className={classNames(
        'ob-card relative w-[280px] max-w-[280px] shrink-0 cursor-grab rounded-[24px] px-4 py-3 text-left backdrop-blur-xl transition hover:-translate-y-0.5 active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2',
        active && 'ob-card-active',
      )}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => onTicketDragStart(event, session)}
      onClick={() => onOpen(session)}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start gap-2">
        {busy ? <BusyDot /> : null}
        <p className="ob-text min-w-0 truncate text-sm font-semibold">{session.title}</p>
      </div>
      {hasPendingQuestion ? (
        <PrepQuestionPopoverTrigger
          open={questionPopoverOpen}
          questions={questions}
          pendingQuestion={pendingQuestion}
          onOpenChange={onQuestionPopoverChange}
          onQuestionReply={onQuestionReply}
          onPointerDown={stopCardInteraction}
        />
      ) : <SessionPreview sessionId={session.id} />}
      {phaseStatus ? <PhaseStatusChip status={phaseStatus} /> : null}
    </div>
  )
}

function PrepQuestionPopoverTrigger({ open, questions, pendingQuestion, onOpenChange, onQuestionReply, onPointerDown }: { open: boolean; questions: OpenCodeQuestionRequest[]; pendingQuestion?: OpenCodeQuestionRequest; onOpenChange: (open: boolean) => void; onQuestionReply: (requestID: string, answers: string[][]) => Promise<void>; onPointerDown: (event: PointerEvent<HTMLElement>) => void }) {
  return (
    <div className="mt-2">
      <Popover.Root open={open} onOpenChange={(nextOpen) => onOpenChange(nextOpen)}>
        <Popover.Trigger
          className="ob-secondary-button inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={onPointerDown}
        >
          <span className="size-1.5 rounded-full bg-[var(--ob-primary)]" aria-hidden="true" />
          Question pending
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={12}>
            <Popover.Popup
              className="ob-card z-50 w-[min(340px,calc(100vw-2rem))] cursor-default rounded-[24px] p-3 shadow-2xl backdrop-blur-2xl"
              initialFocus={false}
              finalFocus={false}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={onPointerDown}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <Popover.Title className="ob-muted text-xs font-medium uppercase tracking-[0.12em]">Pending Question</Popover.Title>
                <Popover.Close className="ob-icon-button grid size-7 place-items-center rounded-full text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Close question">×</Popover.Close>
              </div>
              {pendingQuestion ? (
                <QuestionRequestCard questionList={pendingQuestion.questions} requestID={pendingQuestion.id} onQuestionReply={onQuestionReply} />
              ) : (
                <div className="ob-empty rounded-2xl px-3 py-2 text-sm leading-5">
                  Question details are still syncing. Open the prep chat if this does not appear in a moment.
                </div>
              )}
              {questions.length > 1 ? <p className="ob-muted mt-2 text-xs">{questions.length - 1} more pending question{questions.length === 2 ? '' : 's'} on this prep session.</p> : null}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
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

function PhaseStatusChip({ status }: { status: PhaseMarkerStatus }) {
  return <span className={`ob-status-chip ob-status-chip-${status.tone} mt-2 rounded-full px-2.5 py-1 text-center text-xs font-semibold`}>{status.label}</span>
}
