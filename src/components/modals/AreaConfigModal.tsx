import { Button } from '@base-ui/react/button'
import { useState, type FormEvent } from 'react'
import { defaultPromptTemplates } from '../../app/config'
import type { BoardAreaId } from '../../app/types'

export function AreaConfigModal({
  area,
  areaLabel,
  template,
  onClose,
  onSave,
}: {
  area: BoardAreaId
  areaLabel: string
  template: string
  onClose: () => void
  onSave: (template: string) => void
}) {
  const [draft, setDraft] = useState(template)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave(draft)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6 backdrop-blur-sm">
      <div className="ob-surface max-h-[calc(100svh-3rem)] w-full max-w-[680px] overflow-y-auto rounded-[34px] p-5 backdrop-blur-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="ob-muted text-xs font-medium uppercase tracking-[0.12em]">{areaLabel} config</p>
            <h2 className="ob-text mt-1 text-lg font-semibold tracking-[-0.02em]">Automated message</h2>
            <p className="ob-muted mt-1 max-w-[38rem] text-sm leading-5">
              Customize the message sent when this area starts work. Use <code className="ob-code rounded-md px-1 py-0.5">{'{{user_message}}'}</code> where the user or card content should be injected.
            </p>
          </div>
          <Button className="ob-icon-button grid size-8 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2" type="button" aria-label="Close area config" onClick={onClose}>×</Button>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="ob-text grid gap-1.5 text-sm font-medium">
            Default message format
            <textarea
              className="ob-input min-h-72 resize-y rounded-[24px] px-4 py-3 font-mono text-xs font-normal leading-5 outline-none transition"
              value={draft}
              spellCheck={false}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>

          {!draft.includes('{{user_message}}') ? (
            <p className="ob-warning rounded-2xl px-3 py-2 text-sm leading-5">
              This template does not include {'{{user_message}}'}, so OpenBoard will append the user message to the end.
            </p>
          ) : null}

          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button className="ob-secondary-button rounded-full px-4 py-2 text-sm font-medium backdrop-blur-xl transition focus-visible:outline-2 focus-visible:outline-offset-2" type="button" onClick={() => setDraft(defaultPromptTemplates[area])}>
              Reset default
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button className="ob-secondary-button rounded-full px-4 py-2 text-sm font-medium backdrop-blur-xl transition focus-visible:outline-2 focus-visible:outline-offset-2" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button className="ob-primary rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2" type="submit" disabled={!draft.trim()}>
                Save config
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
