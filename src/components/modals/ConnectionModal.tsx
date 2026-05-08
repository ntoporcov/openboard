import { Button } from '@base-ui/react/button'
import { useState, type FormEvent } from 'react'
import {
  normalizeRequestHeaders,
  validateOpenCodeConnection,
  type OpenCodeHealthResponse,
  type OpenCodeRequestHeader,
  type OpenCodeServerConfig,
} from '../../opencodeClient'

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
  const [headerText, setHeaderText] = useState(() => requestHeadersToText(initialConfig.requestHeaders))
  const [status, setStatus] = useState<'idle' | 'checking'>('idle')
  const [error, setError] = useState(initialError)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('checking')
    setError(null)

    try {
      const config = { ...formConfig, requestHeaders: parseRequestHeaders(headerText) }
      const health = await validateOpenCodeConnection(config)
      onValidated(config, health)
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

          <label className="ob-text grid gap-1.5 text-sm font-medium">
            Request headers
            <textarea
              className="ob-input min-h-24 rounded-2xl px-3 py-2.5 text-sm font-normal leading-5 outline-none backdrop-blur-xl transition"
              value={headerText}
              placeholder={'Authorization: Bearer token\nX-OpenBoard: true'}
              spellCheck={false}
              onChange={(event) => setHeaderText(event.target.value)}
            />
            <span className="ob-muted text-xs font-normal leading-4">
              Optional. Add one header per line as <span className="font-mono">Name: value</span>. These are sent with every
              OpenCode API request from this browser.
            </span>
          </label>

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

function requestHeadersToText(headers: OpenCodeRequestHeader[] | undefined) {
  return normalizeRequestHeaders(headers)
    .map((header) => `${header.name}: ${header.value}`)
    .join('\n')
}

function parseRequestHeaders(headerText: string) {
  return headerText.split('\n').reduce<OpenCodeRequestHeader[]>((headers, line, index) => {
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      return headers
    }

    const separatorIndex = trimmedLine.indexOf(':')

    if (separatorIndex <= 0) {
      throw new Error(`Request header line ${index + 1} must use "Name: value".`)
    }

    const name = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim()

    if (!value) {
      throw new Error(`Request header line ${index + 1} must include a value.`)
    }

    try {
      new Headers([[name, value]])
    } catch {
      throw new Error(`Request header line ${index + 1} has an invalid header name or value.`)
    }

    headers.push({ name, value })
    return headers
  }, [])
}
