import { Button } from '@base-ui/react/button'

type LegalTopic = 'license' | 'privacy'

const legalContent: Record<LegalTopic, { eyebrow: string; title: string; body: string[] }> = {
  license: {
    eyebrow: 'Open source',
    title: 'MIT License',
    body: [
      'OpenBoard is released as MIT open source software.',
      'You can use, copy, modify, merge, publish, distribute, sublicense, and sell copies of the software under the MIT License, provided the license notice is included.',
      'The software is provided as-is, without warranty of any kind.',
    ],
  },
  privacy: {
    eyebrow: 'Data & Privacy',
    title: 'A local client for OpenCode',
    body: [
      'OpenBoard stores board state, prep sessions, cards, connection settings, and UI preferences in this browser using localStorage and IndexedDB.',
      'OpenBoard does not run its own server or send your data to an OpenBoard backend.',
      'The only server OpenBoard talks to is the OpenCode server you configure. OpenCode manages AI provider tokens, model communication, project access, and session history.',
      'In short: this app is just a browser client for supervising OpenCode work.',
    ],
  },
}

export function LegalInfoModal({ topic, onClose }: { topic: LegalTopic; onClose: () => void }) {
  const content = legalContent[topic]

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6 backdrop-blur-sm">
      <div className="ob-surface w-full max-w-[560px] rounded-[34px] p-5 backdrop-blur-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="ob-accent text-xs font-semibold uppercase tracking-[0.16em]">{content.eyebrow}</p>
            <h2 className="ob-text mt-1 text-lg font-semibold tracking-[-0.02em]">{content.title}</h2>
          </div>
          <Button
            className="ob-icon-button grid size-8 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2"
            type="button"
            aria-label={`Close ${content.title} dialog`}
            onClick={onClose}
          >
            ×
          </Button>
        </div>

        <div className="grid gap-3 text-sm leading-5">
          {content.body.map((paragraph) => (
            <p key={paragraph} className="ob-muted">{paragraph}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

export type { LegalTopic }
