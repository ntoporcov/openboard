// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenBoardPrepSession } from '../../openboardDb'
import { PrepSidebar } from './PrepSidebar'

const session: OpenBoardPrepSession = {
  id: 'prep_1',
  title: 'Test prep session',
  projectDirectory: '/Users/example/project',
  opencodeSessionId: 'ses_1',
  createdAt: 1,
  updatedAt: 2,
  status: 'prepping',
}

let root: Root | null = null
let container: HTMLDivElement | null = null

describe('PrepSidebar', () => {
  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()

    if (root) {
      act(() => root?.unmount())
    }

    root = null
    container?.remove()
    container = null
  })

  it('calls onDelete after the chat options delete action is confirmed inline', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)

    await renderSidebar({ onDelete })

    await act(async () => {
      buttonNamed('Delete prep session').click()
    })

    expect(onDelete).not.toHaveBeenCalled()

    await act(async () => {
      buttonNamed('Click again to delete').click()
    })

    expect(onDelete).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith(session)
  })

  it('does not call onDelete on the first delete click', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)

    await renderSidebar({ onDelete })

    await act(async () => {
      buttonNamed('Delete prep session').click()
    })

    expect(onDelete).not.toHaveBeenCalled()
  })
})

async function renderSidebar({ onDelete }: { onDelete: (selectedSession: OpenBoardPrepSession) => Promise<void> }) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)

  await act(async () => {
    root?.render(
      <PrepSidebar
        mode="open"
        session={session}
        childSessions={[]}
        questions={[]}
        permissions={[]}
        events={[]}
        error={null}
        onClose={vi.fn()}
        onDelete={onDelete}
        onOpenChildSession={vi.fn()}
        onQuestionReply={vi.fn()}
        onPermissionReply={vi.fn()}
        onPromptSubmit={vi.fn()}
      />,
    )
  })
}

function buttonNamed(name: string) {
  const button = Array.from(document.querySelectorAll('button')).find((element) => element.textContent === name)

  if (!button) throw new Error(`Unable to find button named ${name}`)

  return button
}
