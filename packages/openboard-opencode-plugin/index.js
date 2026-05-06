import { tool } from '@opencode-ai/plugin'

const boardStatuses = ['prep', 'plan', 'build', 'review', 'test', 'done', 'blocked']

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

export const OpenBoardPlugin = async (_ctx, options = {}) => {
  const apiUrl = resolveApiUrl(options)

  return {
    tool: {
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
