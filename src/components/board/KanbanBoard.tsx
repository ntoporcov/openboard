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
import { useMemo, useState, type CSSProperties, type HTMLAttributes } from 'react'
import type { AreaAgentSelections, Card, Column, ColumnId } from '../../app/types'
import type { OpenCodeAgent } from '../../opencodeClient'
import { fallbackAgentSelections } from '../../app/config'
import { classNames, displayAgentName, selectedAgentName } from '../../app/utils'
import { AreaAgentSelect } from '../agents/AreaAgentSelect'

export function KanbanBoard({
  columns,
  cards,
  agents,
  agentSelections,
  chatAffordance,
  onCardsChange,
  onAgentSelected,
  onConfigureArea,
  onPrepTicketDrop,
}: {
  columns: Column[]
  cards: Card[]
  agents: OpenCodeAgent[]
  agentSelections: AreaAgentSelections
  chatAffordance: boolean
  onCardsChange: (cards: Card[] | ((cards: Card[]) => Card[])) => void
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

    onCardsChange((currentCards) => {
      const oldIndex = currentCards.findIndex((card) => card.id === activeCardId)
      const overIndex = currentCards.findIndex((card) => card.id === overId)

      if (oldIndex === -1) return currentCards

      const movedCard = { ...currentCards[oldIndex], status: nextStatus }
      const updatedCards = currentCards.toSpliced(oldIndex, 1, movedCard)

      if (overIndex === -1 || activeCardId === overId) return updatedCards

      return arrayMove(updatedCards, oldIndex, overIndex)
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex">
        <section className="grid w-screen shrink-0 grid-cols-[repeat(4,minmax(230px,1fr))] gap-3 px-4 pb-3 sm:px-6 lg:px-8" aria-label="Kanban board">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              cards={cards.filter((card) => card.status === column.id)}
              agents={agents}
              selectedAgent={agentSelections[column.id]}
              fallbackAgent={fallbackAgentSelections[column.id]}
              onAgentSelected={(agentName) => onAgentSelected(column.id, agentName)}
              onConfigure={() => onConfigureArea(column.id)}
              onPrepTicketDrop={(prepSessionId) => onPrepTicketDrop(column.id, prepSessionId)}
            />
          ))}
        </section>
        {chatAffordance ? <div className="hidden w-[calc(500px_+_0.75rem)] shrink-0 2xl:block" aria-hidden="true" /> : null}
      </div>

      <DragOverlay>{activeCard ? <TaskCard card={activeCard} overlay /> : null}</DragOverlay>
    </DndContext>
  )
}

function KanbanColumn({
  column,
  cards,
  agents,
  selectedAgent,
  fallbackAgent,
  onAgentSelected,
  onConfigure,
  onPrepTicketDrop,
}: {
  column: Column
  cards: Card[]
  agents: OpenCodeAgent[]
  selectedAgent: string
  fallbackAgent: string
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
      className={classNames('ob-column min-h-[560px] rounded-[32px] p-3 backdrop-blur-2xl transition-colors', isOver && 'ob-column-over')}
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
      <header className="mb-3 flex items-start justify-between gap-4 px-1 py-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="ob-text text-[0.95rem] font-semibold tracking-[-0.01em]">{column.title}</h2>
            <span className="ob-pill ob-accent grid size-6 place-items-center rounded-full text-[0.7rem] font-medium backdrop-blur-xl">{cards.length}</span>
          </div>
          <p className="ob-muted mt-0.5 text-sm">{column.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button className="ob-icon-button grid size-8 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2" type="button" aria-label={`Configure ${column.title}`} title={`Configure ${column.title}`} onClick={onConfigure}>
            <span aria-hidden="true">&#9881;</span>
          </Button>
          <AreaAgentSelect agents={agents} areaLabel={column.title} value={selectedAgent} fallbackValue={fallbackAgent} onChange={onAgentSelected} />
        </div>
      </header>

      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        <div className="grid min-h-[460px] content-start gap-2.5">
          {cards.map((card) => <SortableTaskCard key={card.id} card={card} />)}
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

function SortableTaskCard({ card }: { card: Card }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })

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
    <div className={classNames('ob-card group rounded-[24px] p-3 backdrop-blur-xl transition hover:-translate-y-0.5', overlay && 'w-[290px]', hidden && 'opacity-30')} ref={refCallback} style={style}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="ob-pill ob-accent rounded-full px-2.5 py-1 text-xs font-medium">{card.agent}</span>
        <Button className="ob-icon-button grid size-8 cursor-grab place-items-center rounded-full transition active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2" type="button" aria-label={`Move ${card.title}`} {...dragHandleProps}>
          <span className="flex flex-col gap-1">
            <span className="block h-0.5 w-3 rounded-full bg-current" />
            <span className="block h-0.5 w-3 rounded-full bg-current" />
          </span>
        </Button>
      </div>
      <h3 className="ob-text text-[0.96rem] font-semibold leading-snug tracking-[-0.01em]">{card.title}</h3>
      <p className="ob-muted mt-2 text-sm leading-5">{card.prompt}</p>
    </div>
  )
}
