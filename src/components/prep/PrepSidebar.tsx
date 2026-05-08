import { Button } from '@base-ui/react/button'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { PermissionReply, SessionEvent, SidebarState } from '../../app/types'
import { formatRelativeTime } from '../../app/utils'
import { useSessionMessages } from '../../messageStreamStore'
import type { OpenCodePermissionRequest, OpenCodeQuestionRequest, OpenCodeSession } from '../../opencodeClient'
import type { OpenBoardPrepSession } from '../../openboardDb'
import { ChatMessages } from '../chat/ChatMessages'

export function PrepSidebar({
  mode,
  session,
  childSessions,
  questions,
  permissions,
  events,
  error,
  onClose,
  onDelete,
  onOpenChildSession,
  onQuestionReply,
  onPermissionReply,
  onPromptSubmit,
}: {
  mode: SidebarState
  session: OpenBoardPrepSession | null
  childSessions: OpenCodeSession[]
  questions: OpenCodeQuestionRequest[]
  permissions: OpenCodePermissionRequest[]
  events: SessionEvent[]
  error: string | null
  onClose: () => void
  onDelete: (session: OpenBoardPrepSession) => Promise<void>
  onOpenChildSession: (session: OpenCodeSession) => void
  onQuestionReply: (requestID: string, answers: string[][]) => Promise<void>
  onPermissionReply: (requestID: string, reply: PermissionReply) => Promise<void>
  onPromptSubmit: (text: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<'idle' | 'working'>('idle')
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting'>('idle')
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const messages = useSessionMessages(session?.id)
  const latestEvent = events[0]
  const streamLabel = latestEvent ? `${latestEvent.type} ${formatRelativeTime(latestEvent.at)}` : 'Listening'
  const sessionQuestions = session
    ? questions.filter((question) => question.sessionID === session.opencodeSessionId || question.sessionID === session.id)
    : []
  const sessionPermissions = session
    ? permissions.filter((permission) => permission.sessionID === session.opencodeSessionId)
    : []
  const hasPendingQuestion = sessionQuestions.length > 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, status, localError, error, hasPendingQuestion])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (hasPendingQuestion || !draft.trim()) return

    const submittedDraft = draft.trim()

    setStatus('working')
    setLocalError(null)
    setDraft('')

    try {
      await onPromptSubmit(submittedDraft)
    } catch (submitError) {
      setDraft(submittedDraft)
      setLocalError(submitError instanceof Error ? submitError.message : 'Unable to send message.')
    } finally {
      setStatus('idle')
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return

    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  async function handleDelete() {
    if (!session) return

    if (!deleteConfirming) {
      setDeleteConfirming(true)
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
            <h2 className="ob-text mt-1 truncate text-lg font-semibold tracking-[-0.02em]">{session?.title}</h2>
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
                  <Button className="mt-3 w-full rounded-full border border-[#ff3b30]/15 bg-[#ff3b30]/5 px-3 py-2 text-sm font-semibold text-[#b42318] transition hover:bg-[#ff3b30]/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff3b30]" type="button" disabled={deleteStatus === 'deleting'} onClick={handleDelete}>
                    {deleteStatus === 'deleting' ? 'Deleting...' : deleteConfirming ? 'Click again to delete' : 'Delete prep session'}
                  </Button>
                </div>
              </details>
            ) : null}
            <Button className="ob-icon-button grid size-8 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2" type="button" aria-label="Close prep chat" onClick={onClose}>×</Button>
          </div>
        </div>
      </header>

      <div className="ob-chat min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4">
        <ChatMessages
          messages={messages}
          childSessions={childSessions}
          questions={sessionQuestions}
          permissions={sessionPermissions}
          busy={status === 'working'}
          onOpenChildSession={onOpenChildSession}
          onQuestionReply={onQuestionReply}
          onPermissionReply={onPermissionReply}
        />
        <div ref={bottomRef} />
      </div>

      <form className="ob-sidebar-footer p-4 backdrop-blur-2xl backdrop-saturate-150" onSubmit={handleSubmit}>
        {(error || localError) && <p className="ob-danger mb-3 rounded-2xl px-3 py-2 text-sm leading-5">{localError ?? error}</p>}
        {hasPendingQuestion ? (
          <p className="ob-empty rounded-2xl px-3 py-2 text-sm leading-5">Answer the pending question above to continue this session.</p>
        ) : (
          <>
            <textarea
              className="ob-input min-h-24 w-full resize-none rounded-[24px] px-4 py-3 text-sm leading-5 outline-none transition"
              value={draft}
              placeholder="Prep the session: goals, repo context, files to inspect, constraints, and acceptance criteria..."
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="ob-muted text-xs">Enter sends. Shift Enter adds a line.</p>
              <Button className="ob-primary rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2" type="submit" disabled={status === 'working' || !draft.trim()}>
                {status === 'working' ? 'Sending...' : 'Send to OpenCode'}
              </Button>
            </div>
          </>
        )}
      </form>
    </aside>
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
