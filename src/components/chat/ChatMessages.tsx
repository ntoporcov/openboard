import { Button } from '@base-ui/react/button'
import { useState, type ReactNode } from 'react'
import {
  type OpenCodeMessage,
  type OpenCodeMessagePart,
  type OpenCodePermissionRequest,
  type OpenCodeQuestionRequest,
  type OpenCodeSession,
} from '../../opencodeClient'

type PermissionReply = 'once' | 'always' | 'reject'

type ChatMessagesProps = {
  messages: OpenCodeMessage[]
  childSessions: OpenCodeSession[]
  questions: OpenCodeQuestionRequest[]
  permissions: OpenCodePermissionRequest[]
  busy: boolean
  onOpenChildSession: (session: OpenCodeSession) => void
  onQuestionReply: (requestID: string, answers: string[][]) => Promise<void>
  onPermissionReply: (requestID: string, reply: PermissionReply) => Promise<void>
}

export function ChatMessages(props: ChatMessagesProps) {
  const renderedToolCallIDs = collectRenderedToolCallIDs(props.messages)
  const pendingQuestions = props.questions.filter((question) => !question.tool?.callID || !renderedToolCallIDs.has(question.tool.callID))
  const pendingPermissions = props.permissions.filter((permission) => !permission.tool?.callID || !renderedToolCallIDs.has(permission.tool.callID))

  if (props.messages.length === 0 && pendingQuestions.length === 0 && pendingPermissions.length === 0) {
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
      {props.messages.map((message) => (
        <MessageBubble key={message.info.id} message={message} {...props} />
      ))}
      {pendingQuestions.map((request) => (
        <PendingQuestionRequest key={request.id} request={request} onQuestionReply={props.onQuestionReply} />
      ))}
      {pendingPermissions.map((permission) => (
        <PermissionRequestCard key={permission.id} permission={permission} onPermissionReply={props.onPermissionReply} />
      ))}
      {props.busy ? <TypingIndicator /> : null}
    </div>
  )
}

function collectRenderedToolCallIDs(messages: OpenCodeMessage[]) {
  const callIDs = new Set<string>()

  messages.forEach((message) => {
    message.parts.forEach((part) => {
      if (part.type === 'tool' && typeof part.callID === 'string') callIDs.add(part.callID)
    })
  })

  return callIDs
}

function MessageBubble({
  message,
  childSessions,
  questions,
  permissions,
  onOpenChildSession,
  onQuestionReply,
  onPermissionReply,
}: ChatMessagesProps & { message: OpenCodeMessage }) {
  const user = message.info.role === 'user'
  const errorText = formatMessageError(message.info.error)
  const visibleParts = message.parts.filter(isVisibleMessagePart)

  if (!errorText && visibleParts.length === 0 && !user) return null

  return (
    <div className={classNames('flex', user ? 'justify-end' : 'justify-start')}>
      <article className={classNames(user ? 'ob-user-bubble max-w-[78%] rounded-[22px] rounded-br-md px-4 py-2.5' : 'ob-text w-full px-1 py-1')}>
        <div className={classNames('mb-1.5 flex items-center justify-between gap-3', user && 'hidden')}>
          <div className="flex min-w-0 items-center gap-2">
            <span className={classNames('grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold', user ? 'bg-white/20 text-white' : 'ob-agent-avatar')}>
              {user ? 'You' : 'OC'}
            </span>
            <div className="min-w-0">
              <p className="ob-muted text-xs font-medium uppercase tracking-[0.12em]">{user ? 'You' : message.info.agent || 'OpenCode'}</p>
              {!user && message.info.model ? (
                <p className="ob-muted truncate text-xs">{message.info.model.providerID}/{message.info.model.modelID}</p>
              ) : null}
            </div>
          </div>
          {message.info.time?.created ? <p className="ob-muted shrink-0 text-xs">{formatRelativeTime(message.info.time.created)}</p> : null}
        </div>

        <div className={classNames('grid gap-2 text-sm leading-5', user ? 'text-white' : 'ob-text')}>
          {errorText ? <MessageError text={errorText} /> : null}
          {visibleParts.length > 0 ? (
            visibleParts.map((part) => (
              <MessagePart
                key={part.id}
                part={part}
                childSessions={childSessions}
                questions={questions}
                permissions={permissions}
                onOpenChildSession={onOpenChildSession}
                onQuestionReply={onQuestionReply}
                onPermissionReply={onPermissionReply}
              />
            ))
          ) : !errorText ? (
            <p className={classNames(user ? 'text-white/70' : 'ob-muted')}>Message metadata received.</p>
          ) : null}
        </div>
        {user && message.info.time?.created ? <p className="mt-1 text-right text-[0.68rem] text-white/70">{formatRelativeTime(message.info.time.created)}</p> : null}
      </article>
    </div>
  )
}

function MessagePart({
  part,
  childSessions,
  questions,
  permissions,
  onOpenChildSession,
  onQuestionReply,
  onPermissionReply,
}: Omit<ChatMessagesProps, 'messages' | 'busy'> & { part: OpenCodeMessagePart }) {
  if (part.type === 'text' && part.text) return <MarkdownText text={part.text} />
  if (part.type === 'subtask') return <SubagentSessionPart part={part} childSessions={childSessions} onOpenChildSession={onOpenChildSession} />

  if (part.type === 'file') {
    return <InfoCard eyebrow="File" title={part.filename ?? part.url ?? 'Attachment'} />
  }

  if (part.type === 'tool') {
    const childSession = childSessionForToolPart(part, childSessions)
    if (part.tool === 'task' && childSession) return <SubagentSessionPart part={part} childSessions={childSessions} onOpenChildSession={onOpenChildSession} />
    if (part.tool === 'question') return <QuestionToolPart part={part} questions={questions} onQuestionReply={onQuestionReply} />

    const permission = permissionForToolPart(part, permissions)
    if (permission) return <PermissionRequestCard part={part} permission={permission} onPermissionReply={onPermissionReply} />

    return <InfoCard eyebrow="Tool" title={part.tool ?? part.state?.title ?? 'Tool call'} subtitle={part.state?.status} />
  }

  return <p className="ob-empty rounded-2xl px-3 py-2">{part.type}</p>
}

function InfoCard({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="ob-static-card rounded-2xl px-3 py-2">
      <p className="ob-muted text-xs font-medium uppercase tracking-[0.12em]">{eyebrow}</p>
      <p className="ob-text mt-1 truncate text-sm font-medium">{title}</p>
      {subtitle ? <p className="ob-muted mt-1 text-xs">{subtitle}</p> : null}
    </div>
  )
}

function isVisibleMessagePart(part: OpenCodeMessagePart) {
  return part.type !== 'step-start' && part.type !== 'step-finish'
}

function SubagentSessionPart({ part, childSessions, onOpenChildSession }: { part: OpenCodeMessagePart; childSessions: OpenCodeSession[]; onOpenChildSession: (session: OpenCodeSession) => void }) {
  const childSession = part.type === 'tool' ? childSessionForToolPart(part, childSessions) : childSessionForSubtaskPart(part, childSessions)
  const input = isRecord(part.state?.input) ? part.state.input : null
  const agent = typeof part.agent === 'string' ? part.agent : typeof input?.subagent_type === 'string' ? input.subagent_type : 'subagent'
  const description = typeof part.description === 'string' ? part.description : typeof input?.description === 'string' ? input.description : part.state?.title ?? 'Sub-agent session'
  const status = typeof part.state?.status === 'string' ? part.state.status : childSession ? 'ready' : 'starting'

  return (
    <div className="ob-static-card rounded-2xl px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="ob-muted text-xs font-medium uppercase tracking-[0.12em]">Sub-agent</p>
          <p className="ob-text mt-1 truncate text-sm font-semibold">{description}</p>
          <p className="ob-muted mt-1 text-xs">{displayAgentName(agent)} · {childSession?.id ?? status}</p>
        </div>
        <Button className="ob-secondary-button shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2" type="button" disabled={!childSession} onClick={() => childSession && onOpenChildSession(childSession)}>
          Open
        </Button>
      </div>
    </div>
  )
}

function QuestionToolPart({ part, questions, onQuestionReply }: { part: OpenCodeMessagePart; questions: OpenCodeQuestionRequest[]; onQuestionReply: (requestID: string, answers: string[][]) => Promise<void> }) {
  const request = questions.find((question) => question.tool?.callID === part.callID)
  const input = isRecord(part.state?.input) ? part.state.input : null
  const metadata = isRecord(part.state?.metadata) ? part.state.metadata : null
  const questionList = request?.questions ?? (Array.isArray(input?.questions) ? input.questions as OpenCodeQuestionRequest['questions'] : [])
  const answers = Array.isArray(metadata?.answers) ? metadata.answers as string[][] : []

  return <QuestionRequestCard key={request?.id ?? part.id} answers={answers} questionList={questionList} requestID={request?.id} onQuestionReply={onQuestionReply} />
}

function PendingQuestionRequest({ request, onQuestionReply }: { request: OpenCodeQuestionRequest; onQuestionReply: (requestID: string, answers: string[][]) => Promise<void> }) {
  return <QuestionRequestCard questionList={request.questions} requestID={request.id} onQuestionReply={onQuestionReply} />
}

function QuestionRequestCard({ questionList, answers = [], requestID, onQuestionReply }: { questionList: OpenCodeQuestionRequest['questions']; answers?: string[][]; requestID?: string; onQuestionReply: (requestID: string, answers: string[][]) => Promise<void> }) {
  const [selectedAnswers, setSelectedAnswers] = useState<string[][]>(() => questionList.map((_, index) => answers[index] ?? []))
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(() => firstUnansweredQuestionIndex(questionList, answers))
  const activeQuestion = questionList[activeQuestionIndex]
  const activeAnswer = selectedAnswers[activeQuestionIndex] ?? []

  function setQuestionAnswer(index: number, answer: string[]) {
    setSelectedAnswers((currentAnswers) => {
      const nextAnswers = [...currentAnswers]
      nextAnswers[index] = answer
      return nextAnswers
    })
  }

  const canContinue = activeAnswer.length > 0
  const canSubmit = !!requestID && questionList.every((_, index) => selectedAnswers[index]?.length > 0)
  const isLastQuestion = activeQuestionIndex >= questionList.length - 1

  function handleContinue() {
    if (!canContinue) return
    setActiveQuestionIndex((currentIndex) => Math.min(currentIndex + 1, questionList.length - 1))
  }

  if (!activeQuestion) return null

  return (
    <div className="ob-static-card rounded-2xl px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="ob-muted text-xs font-medium uppercase tracking-[0.12em]">Question</p>
        {questionList.length > 1 ? (
          <div className="flex items-center gap-1.5" aria-label={`Question ${activeQuestionIndex + 1} of ${questionList.length}`}>
            {questionList.map((_, index) => (
              <span
                key={index}
                className={classNames(
                  'size-1.5 rounded-full transition',
                  index === activeQuestionIndex ? 'ob-question-step-active' : 'ob-question-step',
                )}
              />
            ))}
            <span className="ob-muted ml-1 text-xs">{activeQuestionIndex + 1} of {questionList.length}</span>
          </div>
        ) : null}
      </div>
      <QuestionPrompt
        key={`${activeQuestionIndex}-${activeQuestion.header}-${activeQuestion.question}`}
        question={activeQuestion}
        answer={Array.isArray(answers[activeQuestionIndex]) ? answers[activeQuestionIndex] : undefined}
        selectedAnswer={activeAnswer}
        onAnswerChange={(answer) => setQuestionAnswer(activeQuestionIndex, answer)}
      />
      {!isLastQuestion ? (
        <Button className="ob-secondary-button mt-3 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2" type="button" disabled={!canContinue} onClick={handleContinue}>
          Next question
        </Button>
      ) : null}
      {requestID ? (
        <Button className="ob-secondary-button mt-3 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2" type="button" disabled={!isLastQuestion || !canSubmit} onClick={() => onQuestionReply(requestID, selectedAnswers)}>
          Submit answer
        </Button>
      ) : null}
    </div>
  )
}

function firstUnansweredQuestionIndex(questionList: OpenCodeQuestionRequest['questions'], answers: string[][]) {
  const unansweredIndex = questionList.findIndex((_, index) => !answers[index]?.length)
  return unansweredIndex === -1 ? Math.max(0, questionList.length - 1) : unansweredIndex
}

function QuestionPrompt({ question, answer, selectedAnswer, onAnswerChange }: { question: OpenCodeQuestionRequest['questions'][number]; answer?: string[]; selectedAnswer: string[]; onAnswerChange: (answer: string[]) => void }) {
  const answered = !!answer?.length

  function toggleAnswer(label: string) {
    if (!question.multiple) return onAnswerChange([label])
    onAnswerChange(selectedAnswer.includes(label) ? selectedAnswer.filter((item) => item !== label) : [...selectedAnswer, label])
  }

  return (
    <div className="mt-2 grid gap-2">
      {question.header ? <p className="ob-muted text-xs font-medium">{question.header}</p> : null}
      <p className="ob-text text-sm font-semibold">{question.question}</p>
      <div className="grid gap-1.5">
        {question.options.map((option) => {
          const selected = selectedAnswer.includes(option.label)
          return (
            <button
              key={option.label}
              className={classNames(
                'ob-question-option flex cursor-pointer items-start gap-2 rounded-2xl px-3 py-2 text-left transition disabled:cursor-default disabled:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2',
                selected && 'ob-question-option-selected',
              )}
              type="button"
              disabled={answered}
              onClick={() => toggleAnswer(option.label)}
            >
              <span className="ob-question-option-mark mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[0.62rem] font-semibold">
                {selected ? (
                  <svg className="size-2.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2.5 6.25 5 8.75 9.5 3.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="ob-text block text-sm font-semibold">{option.label}</span>
                {option.description ? <span className="ob-muted mt-0.5 block text-xs leading-4">{option.description}</span> : null}
              </span>
            </button>
          )
        })}
      </div>
      {answered ? <p className="ob-muted text-xs">Answered: {answer.join(', ') || 'No answer'}</p> : null}
    </div>
  )
}

function PermissionRequestCard({ part, permission, onPermissionReply }: { part?: OpenCodeMessagePart; permission: OpenCodePermissionRequest; onPermissionReply: (requestID: string, reply: PermissionReply) => Promise<void> }) {
  return (
    <div className="ob-card rounded-2xl px-3 py-2">
      <p className="ob-muted text-xs font-medium uppercase tracking-[0.12em]">Permission</p>
      <p className="ob-text mt-1 text-sm font-semibold">{permission.permission}</p>
      <p className="ob-muted mt-1 text-xs">{permission.patterns.join(', ') || part?.state?.title || 'Permission requested'}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="ob-secondary-button rounded-full px-3 py-1.5 text-xs font-semibold" type="button" onClick={() => onPermissionReply(permission.id, 'once')}>Allow once</Button>
        <Button className="ob-secondary-button rounded-full px-3 py-1.5 text-xs font-semibold" type="button" onClick={() => onPermissionReply(permission.id, 'always')}>Always allow</Button>
        <Button className="ob-danger rounded-full px-3 py-1.5 text-xs font-semibold" type="button" onClick={() => onPermissionReply(permission.id, 'reject')}>Reject</Button>
      </div>
    </div>
  )
}

function childSessionForSubtaskPart(part: OpenCodeMessagePart, childSessions: OpenCodeSession[]) {
  const description = typeof part.description === 'string' ? part.description : ''
  const agent = typeof part.agent === 'string' ? part.agent : ''
  return childSessions.find((session) => (!description || session.title.startsWith(description)) && (!agent || session.title.includes(`@${agent}`)))
}

function childSessionForToolPart(part: OpenCodeMessagePart, childSessions: OpenCodeSession[]) {
  const metadata = isRecord(part.state?.metadata) ? part.state.metadata : null
  const sessionId = typeof metadata?.sessionId === 'string' ? metadata.sessionId : undefined
  if (sessionId) return childSessions.find((session) => session.id === sessionId)

  const input = isRecord(part.state?.input) ? part.state.input : null
  const description = typeof input?.description === 'string' ? input.description : ''
  const agent = typeof input?.subagent_type === 'string' ? input.subagent_type : ''
  return childSessions.find((session) => (!description || session.title.startsWith(description)) && (!agent || session.title.includes(`@${agent}`)))
}

function permissionForToolPart(part: OpenCodeMessagePart, permissions: OpenCodePermissionRequest[]) {
  return permissions.find((permission) => permission.tool?.callID === part.callID)
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let listItems: string[] = []
  let paragraphLines: string[] = []
  let codeLines: string[] = []
  let inCodeBlock = false

  function flushParagraph() {
    if (!paragraphLines.length) return
    blocks.push(<p key={`p-${blocks.length}`} className="whitespace-pre-wrap">{renderInlineMarkdown(paragraphLines.join('\n'))}</p>)
    paragraphLines = []
  }

  function flushList() {
    if (!listItems.length) return
    blocks.push(<ul key={`ul-${blocks.length}`} className="grid list-disc gap-1 pl-5">{listItems.map((item, index) => <li key={`${index}-${item}`}>{renderInlineMarkdown(item)}</li>)}</ul>)
    listItems = []
  }

  lines.forEach((line) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        blocks.push(<pre key={`pre-${blocks.length}`} className="ob-card overflow-x-auto rounded-2xl px-3 py-2 text-xs leading-5"><code>{codeLines.join('\n')}</code></pre>)
        codeLines = []
      } else {
        flushParagraph(); flushList()
      }
      inCodeBlock = !inCodeBlock
      return
    }
    if (inCodeBlock) return void codeLines.push(line)
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      flushParagraph(); flushList()
      blocks.push(<p key={`h-${blocks.length}`} className="font-semibold tracking-[-0.01em]">{renderInlineMarkdown(heading[2])}</p>)
      return
    }
    const listItem = line.match(/^\s*[-*]\s+(.+)$/)
    if (listItem) {
      flushParagraph(); listItems.push(listItem[1]); return
    }
    if (!line.trim()) {
      flushParagraph(); flushList(); return
    }
    flushList(); paragraphLines.push(line)
  })

  flushParagraph(); flushList()
  if (inCodeBlock && codeLines.length) blocks.push(<pre key={`pre-${blocks.length}`} className="ob-card overflow-x-auto rounded-2xl px-3 py-2 text-xs leading-5"><code>{codeLines.join('\n')}</code></pre>)
  return <div className="grid gap-2">{blocks}</div>
}

function renderInlineMarkdown(text: string) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={`${part}-${index}`} className="ob-empty rounded-md px-1 py-0.5 font-mono text-[0.82em]">{part.slice(1, -1)}</code>
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    return <span key={`${part}-${index}`}>{part}</span>
  })
}

function MessageError({ text }: { text: string }) {
  return <div className="ob-danger rounded-2xl px-3 py-2"><p className="text-xs font-semibold uppercase tracking-[0.12em]">OpenCode error</p><p className="mt-1 whitespace-pre-wrap">{text}</p></div>
}

function TypingIndicator() {
  return <div className="flex justify-start"><div className="ob-empty inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm"><span className="ob-dot size-2 animate-pulse rounded-full" />Waiting for OpenCode</div></div>
}

function formatMessageError(error: unknown) {
  if (!error) return null
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null) {
    const data = 'data' in error ? error.data : undefined
    if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') return data.message
    if ('message' in error && typeof error.message === 'string') return error.message
  }
  return 'OpenCode returned an error for this message.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function classNames(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function displayAgentName(agentName: string) {
  return agentName.split(/[-_\s]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function formatRelativeTime(timestamp: number) {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
