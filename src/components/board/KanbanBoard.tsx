import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
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
import { Button } from '@base-ui/react/button'
import { useMemo, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent } from 'react'
import type { AreaAgentSelections, Card, Column, ColumnId } from '../../app/types'
import type { OpenCodeAgent } from '../../opencodeClient'
import { fallbackAgentSelections } from '../../app/config'
import { classNames, displayAgentName, selectedAgentName } from '../../app/utils'
import { useSessionPreview, useSessionPreviewLoading } from '../../messageStreamStore'
import { AreaAgentSelect } from '../agents/AreaAgentSelect'

export function KanbanBoard({
  columns,
  cards,
  agents,
  agentSelections,
  busySessionIds,
  chatAffordance,
  onCardsChange,
  onCardOpen,
  onCardStatusChange,
  onAgentSelected,
  onConfigureArea,
  onPrepTicketDrop,
}: {
  columns: Column[]
  cards: Card[]
  agents: OpenCodeAgent[]
  agentSelections: AreaAgentSelections
  busySessionIds: Set<string>
  chatAffordance: boolean
  onCardsChange: (cards: Card[] | ((cards: Card[]) => Card[])) => void
  onCardOpen: (card: Card) => void
  onCardStatusChange: (card: Card, nextStatus: ColumnId) => void
  onAgentSelected: (columnId: ColumnId, agentName: string) => void
  onConfigureArea: (columnId: ColumnId) => void
  onPrepTicketDrop: (columnId: ColumnId, prepSessionId: string) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const activeCard = cards.find((card) => card.id === activeId) ?? null
  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)

    return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args)
  }

  function getColumnFromTarget(targetId: string): ColumnId | undefined {
    if (columns.some((column) => column.id === targetId)) return targetId as ColumnId

    return cards.find((card) => card.id === targetId)?.status
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeCardId = String(active.id)
    const overId = String(over.id)
    const nextStatus = getColumnFromTarget(overId)

    if (!nextStatus) return

    const activeCard = cards.find((card) => card.id === activeCardId)

    onCardsChange((currentCards) => {
      const oldIndex = currentCards.findIndex((card) => card.id === activeCardId)
      const overIndex = currentCards.findIndex((card) => card.id === overId)

      if (oldIndex === -1) return currentCards

      const movedCard = { ...currentCards[oldIndex], status: nextStatus }
      const updatedCards = currentCards.toSpliced(oldIndex, 1, movedCard)

      if (overIndex === -1 || activeCardId === overId) return updatedCards

      return arrayMove(updatedCards, oldIndex, overIndex)
    })

    if (activeCard && activeCard.status !== nextStatus) onCardStatusChange(activeCard, nextStatus)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-1 min-h-0">
        <section
          className={classNames(
            'grid w-screen shrink-0 grid-cols-[repeat(4,minmax(190px,1fr))] items-stretch gap-3 px-4 pb-3 sm:px-6 lg:px-8',
            chatAffordance && 'min-[1380px]:w-[calc(100dvw_-_500px_-_1.75rem)]',
          )}
          aria-label="Kanban board"
        >
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              cards={cards.filter((card) => card.status === column.id)}
              agents={agents}
              busySessionIds={busySessionIds}
              selectedAgent={agentSelections[column.id]}
              fallbackAgent={fallbackAgentSelections[column.id]}
              onCardOpen={onCardOpen}
              onAgentSelected={(agentName) => onAgentSelected(column.id, agentName)}
              onConfigure={() => onConfigureArea(column.id)}
              onPrepTicketDrop={(prepSessionId) => onPrepTicketDrop(column.id, prepSessionId)}
            />
          ))}
        </section>
        {chatAffordance ? <div className="hidden w-[calc(500px_+_0.75rem)] shrink-0 sm:block min-[1380px]:hidden" aria-hidden="true" /> : null}
      </div>

      <DragOverlay>{activeCard ? <TaskCard card={activeCard} busy={busySessionIds.has(activeCard.id)} overlay /> : null}</DragOverlay>
    </DndContext>
  )
}

function KanbanColumn({
  column,
  cards,
  agents,
  busySessionIds,
  selectedAgent,
  fallbackAgent,
  onCardOpen,
  onAgentSelected,
  onConfigure,
  onPrepTicketDrop,
}: {
  column: Column
  cards: Card[]
  agents: OpenCodeAgent[]
  busySessionIds: Set<string>
  selectedAgent: string
  fallbackAgent: string
  onCardOpen: (card: Card) => void
  onAgentSelected: (agentName: string) => void
  onConfigure: () => void
  onPrepTicketDrop: (prepSessionId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const cardIds = useMemo(() => cards.map((card) => card.id), [cards])
  const activeAgent = selectedAgentName(column.id, selectedAgent, agents) ?? fallbackAgent
  const usingFallbackAgent = activeAgent !== selectedAgent

  return (
    <article
      className={classNames('ob-column flex min-h-[560px] flex-col rounded-[32px] p-3 backdrop-blur-2xl transition-colors', isOver && 'ob-column-over')}
      ref={setNodeRef}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('application/x-openboard-prep-session')) event.preventDefault()
      }}
      onDrop={(event) => {
        const prepSessionId = event.dataTransfer.getData('application/x-openboard-prep-session')

        if (!prepSessionId) return

        event.preventDefault()
        onPrepTicketDrop(prepSessionId)
      }}
    >
      <header className="mb-3 flex flex-col gap-2 px-1 py-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="ob-text text-[0.95rem] font-semibold tracking-[-0.01em]">{column.title}</h2>
              <span className="ob-pill ob-accent grid size-6 place-items-center rounded-full text-[0.7rem] font-medium backdrop-blur-xl">{cards.length}</span>
            </div>
            <p className="ob-muted mt-0.5 text-sm">{column.description}</p>
          </div>
          <Button className="ob-icon-button grid size-8 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2" type="button" aria-label={`Configure ${column.title}`} title={`Configure ${column.title}`} onClick={onConfigure}>
            <span aria-hidden="true">&#9881;</span>
          </Button>
        </div>
        <AreaAgentSelect fullWidth agents={agents} areaLabel={column.title} value={selectedAgent} fallbackValue={fallbackAgent} onChange={onAgentSelected} />
      </header>

      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        <div className="grid flex-1 content-start gap-2.5">
          {cards.map((card) => <SortableTaskCard key={card.id} card={card} busy={busySessionIds.has(card.id)} onOpen={onCardOpen} />)}
          {cards.length === 0 ? (
            <div className="ob-dropzone rounded-[24px] px-4 py-6 text-center text-sm leading-5 backdrop-blur-xl">
              <p>Drop work here when it is ready for {displayAgentName(activeAgent)}.</p>
              {usingFallbackAgent ? (
                <p className="mt-2 text-xs">
                  Install the OpenBoard plugin to use {displayAgentName(selectedAgent)}, or continue with the default
                  OpenCode {displayAgentName(fallbackAgent)} agent.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </SortableContext>
    </article>
  )
}

function SortableTaskCard({ card, busy, onOpen }: { card: Card; busy: boolean; onOpen: (card: Card) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })

  return (
      <TaskCard
        card={card}
        busy={busy}
        onOpen={onOpen}
        dragProps={{ ...attributes, ...listeners }}
        refCallback={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        hidden={isDragging}
    />
  )
}

function TaskCard({
  card,
  busy,
  onOpen,
  overlay = false,
  hidden = false,
  refCallback,
  style,
  dragProps,
}: {
  card: Card
  busy: boolean
  onOpen?: (card: Card) => void
  overlay?: boolean
  hidden?: boolean
  refCallback?: (element: HTMLDivElement | null) => void
  style?: CSSProperties
  dragProps?: HTMLAttributes<HTMLDivElement>
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' || !onOpen) {
      dragProps?.onKeyDown?.(event)
      return
    }

    event.preventDefault()
    onOpen(card)
  }

  return (
    <div
      className={classNames('ob-card group min-w-0 cursor-grab rounded-[24px] p-3 backdrop-blur-xl transition hover:-translate-y-0.5 active:cursor-grabbing', overlay && 'w-[290px]', hidden && 'opacity-30')}
      ref={refCallback}
      style={style}
      {...dragProps}
      onClick={() => onOpen?.(card)}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start gap-2">
        {busy ? <BusyDot /> : null}
        <h3 className="ob-text min-w-0 break-words text-[0.96rem] font-semibold leading-snug tracking-[-0.01em]">{card.title}</h3>
      </div>
      <TaskCardPreview sessionId={card.id} />
    </div>
  )
}

function BusyDot() {
  return <span className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full bg-[var(--ob-primary)] shadow-[0_0_0_3px_rgb(0_122_255_/_0.12)]" aria-label="Chat is busy" />
}

function TaskCardPreview({ sessionId }: { sessionId: string }) {
  const preview = useSessionPreview(sessionId)
  const loading = useSessionPreviewLoading(sessionId)

  return <p className="ob-muted mt-2 line-clamp-2 min-h-10 break-words text-sm leading-5">{loading && !preview ? 'Loading conversation...' : preview || 'No AI response yet.'}</p>
}
