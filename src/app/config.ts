import type { AppearanceSettings, AreaAgentSelections, AreaPromptTemplates, Column } from './types'

export const columns: Column[] = [
  { id: 'plan', title: 'Plan', description: 'Shape work into clear steps.' },
  { id: 'build', title: 'Build', description: 'Implement scoped changes.' },
  { id: 'review', title: 'Review', description: 'Inspect diffs, risks, and quality.' },
  { id: 'test', title: 'Test', description: 'Validate behavior and regressions.' },
]

export const defaultAgentSelections: AreaAgentSelections = {
  prep: 'openboard-prepper',
  plan: 'openboard-planner',
  build: 'openboard-builder',
  review: 'openboard-reviewer',
  test: 'openboard-tester',
}

export const fallbackAgentSelections: AreaAgentSelections = {
  prep: 'plan',
  plan: 'plan',
  build: 'build',
  review: 'plan',
  test: 'plan',
}

export const defaultPromptTemplates: AreaPromptTemplates = {
  prep: `Start a prep conversation for the task below.

Do not think about implementation yet and do not begin coding. Your goal is to help uncover hidden details, constraints, risks, edge cases, dependencies, and decisions the user may not be considering.

Keep this conversational. Avoid long blocks of text, avoid dumping every concern in one reply, and ask one focused question at a time so the user can respond naturally. Briefly explain why a question matters when useful, then wait for the user's answer before moving to the next question or concern.

User's prep instruction:
{{user_message}}`,
  plan: `Create a technical plan for the task below using the current codebase as the source of truth.

Use what Prep uncovered, inspect the relevant code, and describe how to execute the work safely. Focus on architecture, files likely involved, sequencing, risks, and acceptance criteria. Do not implement code yet.

User message:
{{user_message}}`,
  build: `Start implementing the task below.

Use the plan and current codebase context, make the smallest correct changes, and verify the work as you go. Keep the implementation focused on the requested outcome.

User message:
{{user_message}}`,
  review: `Review the completed code for correctness and feature completion against the plan below.

Prioritize bugs, behavioral regressions, missing requirements, risky assumptions, and missing tests. Be direct and specific, with file references where possible.

User message:
{{user_message}}`,
  test: `Test the completed work from the user's perspective.

For UI changes, walk the experience like a user and use Playwright when it can validate UX behavior. For API or library changes, act as a consumer and verify the observable behavior. Look for regressions, edge cases, and mismatches with the requested task.

User message:
{{user_message}}`,
}

export const agentSelectionsStorageKey = 'openboard.agentSelections.v1'
export const appearanceStorageKey = 'openboard.appearance.v1'
export const promptTemplatesStorageKey = 'openboard.promptTemplates.v1'

export const defaultAppearanceSettings: AppearanceSettings = {
  theme: 'cupertino',
  mode: 'system',
}
