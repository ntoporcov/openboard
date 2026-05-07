import { Button } from '@base-ui/react/button'

export function PluginModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 py-6 backdrop-blur-sm">
      <div className="ob-surface w-full max-w-[640px] rounded-[34px] p-5 backdrop-blur-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="ob-accent text-xs font-semibold uppercase tracking-[0.16em]">Recommended setup</p>
            <h2 className="ob-text mt-1 text-lg font-semibold tracking-[-0.02em]">Install the OpenBoard plugin</h2>
            <p className="ob-muted mt-1 text-sm leading-5">
              The plugin adds the Prepper, Planner, Builder, Reviewer, and Tester agents plus board handoff tools.
            </p>
          </div>
          <Button
            className="ob-icon-button grid size-8 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2"
            type="button"
            aria-label="Close plugin instructions"
            onClick={onClose}
          >
            ×
          </Button>
        </div>

        <div className="grid gap-3 text-sm">
          <p className="ob-muted leading-5">
            Add the GitHub Packages registry for the package scope, then add the plugin to your OpenCode config.
            If you use the hosted app, start OpenCode with CORS enabled for GitHub Pages.
          </p>
          <CodePill value="@ntoporcov:registry=https://npm.pkg.github.com" />
          <CodePill value={'"plugin": ["@ntoporcov/openboard-opencode-plugin"]'} />
          <CodePill value="opencode serve --cors https://ntoporcov.github.io" />
        </div>
      </div>
    </div>
  )
}

function CodePill({ value }: { value: string }) {
  return <code className="ob-card rounded-2xl px-3 py-2 font-mono text-xs leading-5">{value}</code>
}
