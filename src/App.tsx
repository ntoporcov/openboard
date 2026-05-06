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
import { useMemo, useState, type CSSProperties, type HTMLAttributes } from 'react'

type ColumnId = 'inbox' | 'planned' | 'active' | 'done'

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
  { id: 'inbox', title: 'Inbox', description: 'New thoughts and requests.' },
  { id: 'planned', title: 'Planned', description: 'Ready for an AI session.' },
  { id: 'active', title: 'Active', description: 'Currently in progress.' },
  { id: 'done', title: 'Done', description: 'Ready to review or ship.' },
]

const initialCards: Card[] = [
  {
    id: 'card-1',
    title: 'Define OpenCode handoff',
    prompt: 'Decide how a board card becomes a scoped OpenCode task.',
    status: 'inbox',
    agent: 'Planner',
  },
  {
    id: 'card-2',
    title: 'Design task context panel',
    prompt: 'Show prompt, affected files, test output, and current status in one place.',
    status: 'planned',
    agent: 'Designer',
  },
  {
    id: 'card-3',
    title: 'Stream coding progress',
    prompt: 'Display OpenCode activity as a calm, readable timeline.',
    status: 'active',
    agent: 'Builder',
  },
  {
    id: 'card-4',
    title: 'Review generated diff',
    prompt: 'Summarize code changes, checks, and risks before the user approves.',
    status: 'done',
    agent: 'Reviewer',
  },
]

function App() {
  const [cards, setCards] = useState(initialCards)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const activeCard = cards.find((card) => card.id === activeId) ?? null

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

  return (
    <main className="min-h-svh bg-[#f5f5f7] text-[#1d1d1f]">
      <div className="mx-auto flex min-h-svh w-full max-w-[1500px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-4 flex flex-col gap-3 rounded-[28px] border border-black/5 bg-white/75 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.06)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-black text-sm font-semibold text-white shadow-sm">
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
            <span className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-[#f5f5f7] px-3 py-1.5 text-sm text-[#6e6e73]">
              <span className="size-2 rounded-full bg-[#34c759]" />
              OpenCode local
            </span>
            <Button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#1d1d1f] shadow-sm transition hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]">
              New task
            </Button>
          </div>
        </header>

        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <InfoCard label="Board" value="4 tasks" />
          <InfoCard label="Session" value="Not connected" />
          <InfoCard label="Mode" value="Human approved" />
        </section>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section
            className="grid flex-1 grid-cols-[repeat(4,minmax(280px,1fr))] gap-3 overflow-x-auto pb-3"
            aria-label="Kanban board"
          >
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={cards.filter((card) => card.status === column.id)}
              />
            ))}
          </section>

          <DragOverlay>{activeCard ? <TaskCard card={activeCard} overlay /> : null}</DragOverlay>
        </DndContext>
      </div>
    </main>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-black/5 bg-white/60 px-4 py-3 backdrop-blur-xl">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#86868b]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#1d1d1f]">{value}</p>
    </div>
  )
}

function KanbanColumn({ column, cards }: { column: Column; cards: Card[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const cardIds = useMemo(() => cards.map((card) => card.id), [cards])

  return (
    <article
      className={classNames(
        'min-h-[560px] rounded-[28px] border p-3 transition-colors',
        isOver ? 'border-[#007aff]/40 bg-[#eaf4ff]' : 'border-black/5 bg-white/55',
      )}
      ref={setNodeRef}
    >
      <header className="mb-3 flex items-start justify-between gap-4 px-1 py-1">
        <div>
          <h2 className="text-[0.95rem] font-semibold tracking-[-0.01em] text-[#1d1d1f]">
            {column.title}
          </h2>
          <p className="mt-0.5 text-sm text-[#86868b]">{column.description}</p>
        </div>
        <span className="grid size-7 place-items-center rounded-full bg-black/[0.04] text-xs font-medium text-[#6e6e73]">
          {cards.length}
        </span>
      </header>

      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        <div className="grid min-h-[460px] content-start gap-2.5">
          {cards.map((card) => (
            <SortableTaskCard key={card.id} card={card} />
          ))}
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
        'group rounded-[22px] border border-black/5 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_30px_rgba(0,0,0,0.05)] transition',
        overlay && 'w-[290px] shadow-[0_20px_60px_rgba(0,0,0,0.16)]',
        hidden && 'opacity-30',
      )}
      ref={refCallback}
      style={style}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="rounded-full bg-[#f5f5f7] px-2.5 py-1 text-xs font-medium text-[#6e6e73]">
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

export default App
