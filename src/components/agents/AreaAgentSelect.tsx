import { Button } from '@base-ui/react/button'
import { useState } from 'react'
import type { OpenCodeAgent } from '../../opencodeClient'
import { classNames, displayAgentName, normalizedAgentOptions } from '../../app/utils'

export function AreaAgentSelect({
  agents,
  areaLabel,
  error,
  fullWidth = false,
  value,
  fallbackValue,
  onChange,
}: {
  agents: OpenCodeAgent[]
  areaLabel: string
  error?: string | null
  fullWidth?: boolean
  value: string
  fallbackValue: string
  onChange: (agentName: string) => void
}) {
  const agentOptions = normalizedAgentOptions(agents)
  const [open, setOpen] = useState(false)
  const selectedAgent = agentOptions.find((agent) => agent.name === value)
    ?? agentOptions.find((agent) => agent.name === fallbackValue)
    ?? agentOptions[0]
  const selectedLabel = selectedAgent ? displayAgentName(selectedAgent.name) : 'No agents'
  const isFallback = selectedAgent?.name !== value

  return (
    <div
      className={classNames('relative inline-flex', fullWidth && 'w-full')}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <Button
        className={classNames(
          'ob-pill inline-flex max-w-[11rem] items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-medium backdrop-blur-xl transition focus-visible:outline-2 focus-visible:outline-offset-2',
          fullWidth && 'w-full max-w-none gap-1.5 px-2 py-1 text-[0.68rem]',
        )}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={agentOptions.length === 0}
        title={error ?? `${areaLabel} agent: ${selectedLabel}${isFallback ? ` (fallback for ${displayAgentName(value)})` : ''}`}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        <span className="ob-muted shrink-0" aria-hidden="true">Agent</span>
        <span className={classNames('ob-accent min-w-0 truncate font-semibold', fullWidth && 'ml-auto text-right')}>{selectedLabel}</span>
        {isFallback ? <span className="ob-muted shrink-0 text-[0.65rem]">fallback</span> : null}
        <span className="ob-muted shrink-0 text-[0.65rem]" aria-hidden="true">▾</span>
      </Button>

      {open && agentOptions.length > 0 ? (
        <div
          className={classNames(
            'ob-menu absolute right-0 top-[calc(100%+0.35rem)] z-30 grid w-[min(15rem,calc(100vw-2rem))] gap-1 rounded-[18px] p-1.5 text-xs backdrop-blur-2xl',
            fullWidth && 'left-0 w-full',
          )}
          role="listbox"
          aria-label={`Agent for ${areaLabel}`}
        >
          {agentOptions.map((agent) => {
            const label = displayAgentName(agent.name)
            const selected = agent.name === selectedAgent?.name

            return (
              <button
                key={agent.name}
                className={classNames(
                  'flex items-center justify-between gap-3 rounded-[14px] px-2.5 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2',
                  selected ? 'ob-card-active' : 'hover:bg-black/[0.04]',
                )}
                type="button"
                role="option"
                aria-selected={selected}
                title={agent.name}
                onClick={() => {
                  onChange(agent.name)
                  setOpen(false)
                }}
              >
                <span className="min-w-0 truncate font-medium">{label}</span>
                {selected ? <span className="ob-accent shrink-0">✓</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
