import type { AppearanceMode, AppearanceSettings, AppearanceTheme } from '../../app/types'

export function AppearanceControls({
  appearance,
  onChange,
}: {
  appearance: AppearanceSettings
  onChange: (nextAppearance: Partial<AppearanceSettings>) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="ob-pill inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-medium backdrop-blur-xl">
        <span className="sr-only">Theme</span>
        <span aria-hidden="true">Theme</span>
        <select
          className="ob-select max-w-28 bg-transparent text-xs font-semibold outline-none"
          value={appearance.theme}
          onChange={(event) => onChange({ theme: event.target.value as AppearanceTheme })}
        >
          <option value="cupertino">Cupertino</option>
          <option value="opencode">OpenCode</option>
        </select>
      </label>
      <label className="ob-pill inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-medium backdrop-blur-xl">
        <span className="sr-only">Mode</span>
        <span aria-hidden="true">Mode</span>
        <select
          className="ob-select max-w-24 bg-transparent text-xs font-semibold outline-none"
          value={appearance.mode}
          onChange={(event) => onChange({ mode: event.target.value as AppearanceMode })}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </div>
  )
}
