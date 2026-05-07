import { tool } from '@opencode-ai/plugin'
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const boardStatuses = ['prep', 'plan', 'build', 'review', 'test', 'done', 'blocked']
const defaultFrontendPort = 4789
const defaultFrontendHost = '127.0.0.1'
const packageDirectory = fileURLToPath(new URL('.', import.meta.url))
const frontendDirectory = join(packageDirectory, 'web')
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
}

let frontendServer = null
let frontendUrl = null

const agentConfigs = {
  'openboard-prepper': {
    description: 'Clarifies work before it is planned or built for OpenBoard tickets.',
    mode: 'primary',
    permission: { edit: 'deny', bash: 'ask', 'openboard_*': 'allow' },
    color: 'info',
    prompt: `You are the OpenBoard Prepper.

Your job is to talk with the user until the ticket is ready for technical planning. Do not implement code. Do not rush into a plan.

Focus on:
- Goal, user value, and success criteria.
- Current behavior versus desired behavior.
- Edge cases, obscure requirements, compatibility constraints, and failure modes.
- Project, branch, environment, and test constraints.
- Any screenshots, logs, URLs, API contracts, or repro steps needed before planning.

When the work is clear, summarize the refined ticket in a compact handoff and use openboard_move_ticket to move it to plan with assignee openboard-planner. If the user still needs to answer questions, keep the ticket in prep and ask only the most important next questions.`,
  },
  'openboard-planner': {
    description: 'Turns prepared OpenBoard tickets into technical implementation plans.',
    mode: 'primary',
    permission: { edit: 'deny', bash: 'ask', task: 'allow', 'openboard_*': 'allow' },
    color: 'accent',
    prompt: `You are the OpenBoard Planner.

Your job is to inspect the codebase and produce a concrete technical plan. Do not edit files.

Focus on:
- Relevant files, existing patterns, APIs, and constraints.
- Minimal implementation strategy and sequencing.
- Data model, UI, integration, and migration impacts.
- Verification strategy, including exact tests or manual checks.
- Risks, unknowns, and questions that would block safe implementation.

When the plan is ready, attach a concise handoff note with openboard_note_ticket and use openboard_move_ticket to move the ticket to build with assignee openboard-builder. If requirements are incomplete, move it back to prep with a specific reason.`,
  },
  'openboard-builder': {
    description: 'Implements OpenBoard tickets according to the planner handoff.',
    mode: 'primary',
    permission: { edit: 'allow', bash: 'ask', task: 'allow', 'openboard_*': 'allow' },
    color: 'success',
    prompt: `You are the OpenBoard Builder.

Your job is to execute the approved plan with the smallest correct code changes. Preserve unrelated worktree changes.

Focus on:
- Follow the planner handoff and call out any required deviation.
- Keep changes minimal, maintainable, and consistent with the repository style.
- Update tests, docs, config, or generated artifacts when the repo workflow requires it.
- Run appropriate verification when feasible.
- Leave a clear handoff for review with changed files, verification, and known risks.

When implementation is ready, use openboard_note_ticket for the handoff and openboard_move_ticket to move the ticket to review with assignee openboard-reviewer. If the plan is blocked or invalid, move it to plan with a precise reason.`,
  },
  'openboard-reviewer': {
    description: 'Reviews code changes against the OpenBoard plan and prepares findings.',
    mode: 'primary',
    permission: { edit: 'deny', bash: 'ask', task: 'allow', 'openboard_*': 'allow' },
    color: 'warning',
    prompt: `You are the OpenBoard Reviewer.

Your job is to review the implementation against the ticket and plan. Do not edit files.

Focus on findings first:
- Behavioral regressions, correctness bugs, and missing requirements.
- Security, data loss, concurrency, and error handling risks.
- Missing or weak tests for changed behavior.
- Deviations from repository conventions or the planned design.

Use file and line references for findings. If there are no findings, say so and list residual testing gaps. Use openboard_note_ticket to attach findings. Move the ticket to test with assignee openboard-tester when review passes, or back to build with assignee openboard-builder when changes are required.`,
  },
  'openboard-tester': {
    description: 'Validates OpenBoard tickets manually or with available automated and MCP test tools.',
    mode: 'primary',
    permission: { edit: 'deny', bash: 'ask', task: 'allow', webfetch: 'allow', 'openboard_*': 'allow' },
    color: 'secondary',
    prompt: `You are the OpenBoard Tester.

Your job is to validate the implemented behavior and catch gaps before the ticket is done. Do not edit files.

Focus on:
- Run the relevant automated checks when feasible.
- Use Playwright or browser MCP tools when available for UI flows.
- Walk the changed code and test the intended behavior, edge cases, and regressions.
- Report exact failures with repro steps, logs, and expected versus actual behavior.

If validation passes, attach a test note with openboard_note_ticket and move the ticket to done. If you find implementation gaps, move it back to build with assignee openboard-builder. If you find planning or requirement gaps, move it back to plan or prep with a concise reason.`,
  },
}

function resolveApiUrl(options = {}) {
  if (typeof options.apiUrl === 'string' && options.apiUrl.trim()) {
    return options.apiUrl.replace(/\/$/, '')
  }

  const envUrl = globalThis.process?.env?.OPENBOARD_API_URL
  return typeof envUrl === 'string' && envUrl.trim() ? envUrl.replace(/\/$/, '') : null
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenBoard API returned ${response.status}: ${text || response.statusText}`)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

function resolveFrontendPort(options = {}) {
  if (Number.isInteger(options.frontendPort)) {
    return options.frontendPort
  }

  const envPort = Number.parseInt(globalThis.process?.env?.OPENBOARD_FRONTEND_PORT ?? '', 10)
  return Number.isInteger(envPort) ? envPort : defaultFrontendPort
}

function resolveFrontendHost(options = {}) {
  if (typeof options.frontendHost === 'string' && options.frontendHost.trim()) {
    return options.frontendHost.trim()
  }

  const envHost = globalThis.process?.env?.OPENBOARD_FRONTEND_HOST
  return typeof envHost === 'string' && envHost.trim() ? envHost.trim() : defaultFrontendHost
}

function frontendOrigin(options = {}) {
  return `http://${resolveFrontendHost(options)}:${resolveFrontendPort(options)}`
}

function normalizeAssetPath(url = '/') {
  const pathname = decodeURIComponent(new URL(url, 'http://openboard.local').pathname)
  const withoutBase = pathname.replace(/^\/openboard\/?/, '')
  const relativePath = withoutBase || 'index.html'
  const normalized = normalize(relativePath).replace(/^\.\.(\/|\\|$)/, '')
  return normalized === '.' ? 'index.html' : normalized
}

async function startFrontendServer(options = {}) {
  if (frontendServer && frontendUrl) {
    return frontendUrl
  }

  const host = resolveFrontendHost(options)
  const port = resolveFrontendPort(options)
  const baseUrl = `http://${host}:${port}`

  await stat(join(frontendDirectory, 'index.html')).catch(() => {
    throw new Error('OpenBoard frontend assets are missing. Reinstall the plugin package or run npm pack after building docs/.')
  })

  const server = createServer(async (request, response) => {
    if (!request.url) {
      response.writeHead(400)
      response.end('Bad request')
      return
    }

    if (request.url === '/') {
      response.writeHead(302, { location: '/openboard/' })
      response.end()
      return
    }

    const relativePath = normalizeAssetPath(request.url)
    const filePath = join(frontendDirectory, relativePath)

    try {
      const file = await stat(filePath)
      if (!file.isFile()) {
        response.writeHead(404)
        response.end('Not found')
        return
      }

      response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] ?? 'application/octet-stream' })
      createReadStream(filePath).pipe(response)
    } catch {
      response.writeHead(404)
      response.end('Not found')
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      resolve()
    })
  })

  frontendServer = server
  frontendUrl = `${baseUrl}/openboard/`
  return frontendUrl
}

export const OpenBoardPlugin = async (_ctx, options = {}) => {
  const apiUrl = resolveApiUrl(options)
  const frontendCorsOrigins = [frontendOrigin(options), `http://localhost:${resolveFrontendPort(options)}`]

  return {
    async config(config) {
      config.agent = { ...agentConfigs, ...config.agent }
      config.default_agent = config.default_agent ?? 'openboard-prepper'
      config.server = {
        ...config.server,
        cors: Array.from(new Set([...(config.server?.cors ?? []), ...frontendCorsOrigins])),
      }
    },
    tool: {
      openboard_start_frontend: tool({
        description: 'Start the bundled OpenBoard kanban frontend locally and return its URL.',
        args: {
          host: tool.schema
            .string()
            .optional()
            .describe('Optional host to bind. Defaults to OPENBOARD_FRONTEND_HOST or 127.0.0.1.'),
          port: tool.schema
            .number()
            .int()
            .optional()
            .describe('Optional port to bind. Defaults to OPENBOARD_FRONTEND_PORT or 4789.'),
        },
        async execute(args) {
          const frontendOptions = { ...options }
          if (args.host) frontendOptions.frontendHost = args.host
          if (args.port) frontendOptions.frontendPort = args.port

          const url = await startFrontendServer(frontendOptions)
          return `OpenBoard is running at ${url}`
        },
      }),
      openboard_move_ticket: tool({
        description:
          'Move an OpenBoard ticket to another board lane when the current agent has finished, found a gap, or needs a handoff.',
        args: {
          ticketId: tool.schema.string().describe('OpenBoard ticket/card id to move.'),
          status: tool.schema.enum(boardStatuses).describe('Target OpenBoard lane.'),
          reason: tool.schema.string().describe('Short reason for the move.'),
          assignee: tool.schema
            .string()
            .optional()
            .describe('Optional next agent name, such as openboard-builder or openboard-tester.'),
        },
        async execute(args, context) {
          const event = {
            ...args,
            sessionId: context.sessionID,
            messageId: context.messageID,
            agent: context.agent,
            at: new Date().toISOString(),
          }

          context.metadata({
            title: `Move ${args.ticketId} to ${args.status}`,
            metadata: event,
          })

          if (!apiUrl) {
            return {
              output:
                'OpenBoard move requested, but no board API is configured. Set OPENBOARD_API_URL or pass { apiUrl } in the plugin config to apply moves automatically.',
              metadata: event,
            }
          }

          const result = await postJson(`${apiUrl}/tickets/${encodeURIComponent(args.ticketId)}/move`, event)
          return {
            output: `Moved ${args.ticketId} to ${args.status}.`,
            metadata: { ...event, result },
          }
        },
      }),
      openboard_note_ticket: tool({
        description: 'Attach a concise handoff, finding, blocker, or test note to an OpenBoard ticket.',
        args: {
          ticketId: tool.schema.string().describe('OpenBoard ticket/card id to annotate.'),
          note: tool.schema.string().describe('The note to attach.'),
          kind: tool.schema.enum(['handoff', 'finding', 'blocker', 'test', 'decision']).describe('Type of note.'),
        },
        async execute(args, context) {
          const event = {
            ...args,
            sessionId: context.sessionID,
            messageId: context.messageID,
            agent: context.agent,
            at: new Date().toISOString(),
          }

          context.metadata({
            title: `Note ${args.ticketId}`,
            metadata: event,
          })

          if (!apiUrl) {
            return {
              output:
                'OpenBoard note requested, but no board API is configured. Set OPENBOARD_API_URL or pass { apiUrl } in the plugin config to persist notes automatically.',
              metadata: event,
            }
          }

          const result = await postJson(`${apiUrl}/tickets/${encodeURIComponent(args.ticketId)}/notes`, event)
          return {
            output: `Added ${args.kind} note to ${args.ticketId}.`,
            metadata: { ...event, result },
          }
        },
      }),
    },
  }
}

export const server = OpenBoardPlugin
export default OpenBoardPlugin
