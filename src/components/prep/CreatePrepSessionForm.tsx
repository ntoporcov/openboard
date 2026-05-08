import { Button } from '@base-ui/react/button'
import { useState, type FormEvent } from 'react'

export function CreatePrepSessionForm({
  connected,
  projectDirectory,
  projectLabel,
  onClose,
  onCreate,
}: {
  connected: boolean
  projectDirectory: string
  projectLabel: string
  onClose: () => void
  onCreate: (input: { instruction: string }) => Promise<void>
}) {
  const [instruction, setInstruction] = useState('')
  const [status, setStatus] = useState<'idle' | 'creating'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('creating')
    setError(null)

    try {
      await onCreate({ instruction })
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to start prep.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6 backdrop-blur-sm">
      <div className="ob-surface max-h-[calc(100svh-3rem)] w-full max-w-[620px] overflow-y-auto rounded-[34px] p-5 backdrop-blur-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="ob-muted text-xs font-medium uppercase tracking-[0.12em]">Prep area</p>
            <h2 className="ob-text mt-1 text-lg font-semibold tracking-[-0.02em]">Start a prep chat</h2>
            <p className="ob-muted mt-1 max-w-[34rem] text-sm leading-5">
              Tell the prep agent what to explore before anyone starts implementation.
            </p>
          </div>
          <Button className="ob-icon-button grid size-8 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2" type="button" aria-label="Close start prep dialog" onClick={onClose}>×</Button>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          {!connected ? <p className="ob-warning rounded-2xl px-3 py-2 text-sm leading-5">Connect to OpenCode before starting prep.</p> : null}
          <div className="ob-card rounded-[24px] px-4 py-3 text-sm backdrop-blur-xl">
            <p className="ob-muted text-xs font-medium uppercase tracking-[0.12em]">Board project</p>
            <p className="ob-text mt-1 truncate font-semibold">{projectLabel}</p>
            <p className="ob-muted mt-1 break-all text-xs leading-4">{projectDirectory}</p>
          </div>
          <label className="ob-text grid gap-1.5 text-sm font-medium">
            Instruction
            <span className="ob-muted text-xs font-normal leading-4">
              Explain what you want to prep through. This can ask the agent to use MCP tools for external detail, gather context, or unpack a fuzzy task before implementation.
            </span>
            <textarea
              className="ob-input min-h-40 resize-y rounded-[24px] px-4 py-3 text-sm font-normal leading-5 outline-none transition"
              value={instruction}
              placeholder="Help me think through the risks and open questions before we add GitHub issue import. Use available MCP context if it helps."
              required
              onChange={(event) => setInstruction(event.target.value)}
            />
          </label>
          {error ? <p className="ob-danger rounded-2xl px-3 py-2 text-sm leading-5">{error}</p> : null}
          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="ob-secondary-button rounded-full px-4 py-2 text-sm font-medium backdrop-blur-xl transition focus-visible:outline-2 focus-visible:outline-offset-2" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button className="ob-primary rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2" type="submit" disabled={!connected || status === 'creating' || !projectDirectory.trim() || !instruction.trim()}>
              {status === 'creating' ? 'Starting...' : 'Start Prep'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
