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

When you think you know enough for the work to move into Plan, say that explicitly and explain the remaining assumptions or risks in a compact handoff. If you do not know enough yet, say what is still missing.

User's prep instruction:
{{user_message}}`,
  plan: `Create a technical plan for the task below using the current codebase as the source of truth.

Use what Prep uncovered, inspect the relevant code, and describe how to execute the work safely. Focus on architecture, files likely involved, sequencing, risks, and acceptance criteria. Do not implement code yet.

If you need a user decision or missing detail before the plan can be reliable, use the Question tool instead of asking inline in chat so OpenBoard can surface it on the card.

Finish this round with a concise conclusion and exactly one marker: [[PLAN_DONE]] when the plan is ready to move forward, or [[PLAN_CHECK]] when the user should read your conclusion or answer questions before the ticket moves on.

User message:
{{user_message}}`,
  build: `Start implementing the task below.

Use the plan and current codebase context, make the smallest correct changes, and verify the work as you go. Keep the implementation focused on the requested outcome.

If you need a user decision, permission choice, or missing product detail, use the Question tool instead of asking inline in chat so OpenBoard can surface it on the card.

Finish this round with a concise conclusion and exactly one marker: [[DEV_DONE]] when implementation is complete and ready for review, or [[DEV_CHECK]] when the user should read your conclusion, answer questions, or decide how to handle a blocker.

User message:
{{user_message}}`,
  review: `Review the completed code for correctness and feature completion against the plan below.

Prioritize bugs, behavioral regressions, missing requirements, risky assumptions, and missing tests. Be direct and specific, with file references where possible.

If you need clarification to determine whether the work is correct, use the Question tool instead of asking inline in chat so OpenBoard can surface it on the card.

Finish this round with a concise conclusion and exactly one marker: [[REVIEW_APPROVED]] when the changes satisfy the plan, or [[REVIEW_CHECK]] when the user should read your conclusion because there are issues, risks, or unresolved questions before moving on.

User message:
{{user_message}}`,
  test: `Test the completed work from the user's perspective.

For UI changes, walk the experience like a user and use Playwright when it can validate UX behavior. For API or library changes, act as a consumer and verify the observable behavior. Look for regressions, edge cases, and mismatches with the requested task.

If you need user input to validate the experience or decide expected behavior, use the Question tool instead of asking inline in chat so OpenBoard can surface it on the card.

Finish this round with a concise conclusion and exactly one marker: [[TEST_APPROVED]] when the work passes validation, or [[TEST_CHECK]] when the user should read your conclusion because validation found issues, risks, or unresolved questions.

User message:
{{user_message}}`,
}

export const phaseReadinessInstructions: AreaPromptTemplates = {
  prep: 'OpenBoard phase check: if you need a user decision or missing detail, use the Question tool instead of asking inline in chat. When you know enough for this ticket to move into Plan, finish with a concise conclusion and compact handoff. If it is not ready for Plan, say what is still missing.',
  plan: 'OpenBoard phase check: if you need a user decision or missing detail, use the Question tool instead of asking inline in chat. Finish with a concise conclusion and exactly one marker: [[PLAN_DONE]] when the plan is ready to move forward, or [[PLAN_CHECK]] when the user should read your conclusion or answer questions before the ticket moves on.',
  build: 'OpenBoard phase check: if you need a user decision, permission choice, or missing product detail, use the Question tool instead of asking inline in chat. Finish with a concise conclusion and exactly one marker: [[DEV_DONE]] when implementation is complete and ready for review, or [[DEV_CHECK]] when the user should read your conclusion, answer questions, or decide how to handle a blocker.',
  review: 'OpenBoard phase check: if you need clarification to determine whether the work is correct, use the Question tool instead of asking inline in chat. Finish with a concise conclusion and exactly one marker: [[REVIEW_APPROVED]] when the changes satisfy the plan, or [[REVIEW_CHECK]] when the user should read your conclusion because there are issues, risks, or unresolved questions before moving on.',
  test: 'OpenBoard phase check: if you need user input to validate the experience or decide expected behavior, use the Question tool instead of asking inline in chat. Finish with a concise conclusion and exactly one marker: [[TEST_APPROVED]] when the work passes validation, or [[TEST_CHECK]] when the user should read your conclusion because validation found issues, risks, or unresolved questions.',
}

export const agentSelectionsStorageKey = 'openboard.agentSelections.v1'
export const appearanceStorageKey = 'openboard.appearance.v1'
export const boardProjectDirectoryStorageKey = 'openboard.boardProjectDirectory.v1'
export const promptTemplatesStorageKey = 'openboard.promptTemplates.v1'
export const projectAgentSelectionsStorageKey = 'openboard.projectAgentSelections.v1'
export const projectPromptTemplatesStorageKey = 'openboard.projectPromptTemplates.v1'

export const defaultAppearanceSettings: AppearanceSettings = {
  theme: 'cupertino',
  mode: 'system',
}
