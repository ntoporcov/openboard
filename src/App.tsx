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
import './App.css'

type ColumnId = 'ideas' | 'ready' | 'active' | 'review'

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
  {
    id: 'ideas',
    title: 'Ideas',
    description: 'Raw product thoughts and user requests.',
  },
  {
    id: 'ready',
    title: 'Ready',
    description: 'Scoped cards ready to send to OpenCode.',
  },
  {
    id: 'active',
    title: 'In Flight',
    description: 'Tasks currently paired with an AI coding session.',
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Changes that need human approval.',
  },
]

const initialCards: Card[] = [
  {
    id: 'card-1',
    title: 'Shape OpenCode session API',
    prompt: 'Define how board cards become OpenCode tasks and stream progress back.',
    status: 'ideas',
    agent: 'Architect',
  },
  {
    id: 'card-2',
    title: 'Drag cards across workflow',
    prompt: 'Create a fast kanban interaction model that works on desktop and touch.',
    status: 'ready',
    agent: 'Builder',
  },
  {
    id: 'card-3',
    title: 'Summarize task context',
    prompt: 'Condense title, acceptance criteria, and files into a prompt package.',
    status: 'active',
    agent: 'Planner',
  },
  {
    id: 'card-4',
    title: 'Review generated diff',
    prompt: 'Present code changes, test output, and risk notes before merge.',
    status: 'review',
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
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">OpenBoard</p>
          <h1 id="app-title">An AI-powered kanban board for OpenCode work.</h1>
          <p className="hero-copy">
            Capture intent, move work through the board, and hand focused cards to
            OpenCode as implementation-ready tasks.
          </p>
        </div>

        <aside className="client-card" aria-label="OpenCode client status">
          <span className="status-dot" />
          <div>
            <strong>OpenCode client</strong>
            <p>Integration seam ready. Wire this to a local OpenCode service next.</p>
          </div>
        </aside>
      </section>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <section className="board" aria-label="Kanban board">
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
    </main>
  )
}

function KanbanColumn({
  column,
  cards,
}: {
  column: Column
  cards: Card[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const cardIds = useMemo(() => cards.map((card) => card.id), [cards])

  return (
    <article className={`column ${isOver ? 'column-over' : ''}`} ref={setNodeRef}>
      <header className="column-header">
        <div>
          <h2>{column.title}</h2>
          <p>{column.description}</p>
        </div>
        <span>{cards.length}</span>
      </header>

      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        <div className="card-stack">
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
      className={`task-card ${overlay ? 'task-card-overlay' : ''} ${hidden ? 'task-card-hidden' : ''}`}
      ref={refCallback}
      style={style}
    >
      <button className="drag-handle" type="button" aria-label={`Move ${card.title}`} {...dragHandleProps}>
        <span />
        <span />
      </button>
      <div>
        <div className="card-meta">
          <span>{card.agent}</span>
          <span>AI task</span>
        </div>
        <h3>{card.title}</h3>
        <p>{card.prompt}</p>
      </div>
    </div>
  )
}

export default App
