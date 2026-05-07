import { Button } from '@base-ui/react/button'
import { useState, type FormEvent } from 'react'
import { validateOpenCodeConnection, type OpenCodeHealthResponse, type OpenCodeServerConfig } from '../../opencodeClient'

export function ConnectionModal({
  initialConfig,
  initialError,
  onClose,
  onValidated,
}: {
  initialConfig: OpenCodeServerConfig
  initialError: string | null
  onClose: () => void
  onValidated: (config: OpenCodeServerConfig, health: OpenCodeHealthResponse) => void
}) {
  const [formConfig, setFormConfig] = useState(initialConfig)
  const [status, setStatus] = useState<'idle' | 'checking'>('idle')
  const [error, setError] = useState(initialError)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('checking')
    setError(null)

    try {
      const health = await validateOpenCodeConnection(formConfig)
      onValidated(formConfig, health)
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : 'Unable to validate the OpenCode connection.',
      )
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6 backdrop-blur-sm">
      <div className="ob-surface w-full max-w-[480px] rounded-[34px] p-5 backdrop-blur-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="ob-text text-lg font-semibold tracking-[-0.02em]">Connect OpenCode</h2>
            <p className="ob-muted mt-1 text-sm leading-5">
              Validate an OpenCode server and cache the connection in this browser.
            </p>
          </div>
          <Button
            className="ob-icon-button grid size-8 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2"
            type="button"
            aria-label="Close connection dialog"
            onClick={onClose}
          >
            ×
          </Button>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="ob-text grid gap-1.5 text-sm font-medium">
            Server URL
            <input
              className="ob-input rounded-2xl px-3 py-2.5 text-sm font-normal outline-none backdrop-blur-xl transition"
              type="url"
              value={formConfig.baseUrl}
              placeholder="http://127.0.0.1:4096"
              required
              onChange={(event) => setFormConfig({ ...formConfig, baseUrl: event.target.value })}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="ob-text grid gap-1.5 text-sm font-medium">
              Username
              <input
                className="ob-input rounded-2xl px-3 py-2.5 text-sm font-normal outline-none backdrop-blur-xl transition"
                type="text"
                value={formConfig.username}
                placeholder="opencode"
                onChange={(event) => setFormConfig({ ...formConfig, username: event.target.value })}
              />
            </label>

            <label className="ob-text grid gap-1.5 text-sm font-medium">
              Password
              <input
                className="ob-input rounded-2xl px-3 py-2.5 text-sm font-normal outline-none backdrop-blur-xl transition"
                type="password"
                value={formConfig.password}
                placeholder="Optional"
                onChange={(event) => setFormConfig({ ...formConfig, password: event.target.value })}
              />
            </label>
          </div>

          {error ? <p className="ob-danger rounded-2xl px-3 py-2 text-sm leading-5">{error}</p> : null}

          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              className="ob-secondary-button rounded-full px-4 py-2 text-sm font-medium backdrop-blur-xl transition focus-visible:outline-2 focus-visible:outline-offset-2"
              type="button"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="ob-primary rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
              type="submit"
              disabled={status === 'checking'}
            >
              {status === 'checking' ? 'Checking...' : 'Validate connection'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
