import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createOpenCodeId,
  createOpenCodeTextPart,
  deleteOpenCodeSession,
  listOpenCodeAgents,
  listOpenCodeProjects,
  sendOpenCodePrompt,
  type OpenCodeServerConfig,
} from './opencodeClient'

const config: OpenCodeServerConfig = {
  baseUrl: 'http://127.0.0.1:4096/',
  username: 'user',
  password: 'pass',
  requestHeaders: [],
}

describe('OpenCode chat client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('creates OpenCode-style ascending identifiers', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    vi.stubGlobal('crypto', { getRandomValues: fillBytes(0) })

    const first = createOpenCodeId('message')
    const second = createOpenCodeId('message')

    expect(first).toMatch(/^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/)
    expect(second).toMatch(/^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/)
    expect(first).toHaveLength(30)
    expect(first.slice(4, 16)).toBe('bcfe56800001')
    expect(second.slice(4, 16)).toBe('bcfe56800002')
    expect(first < second).toBe(true)
  })

  it('creates text parts with OpenCode part identifiers', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_001)
    vi.stubGlobal('crypto', { getRandomValues: fillBytes(1) })

    const part = createOpenCodeTextPart('hello')

    expect(part.id).toMatch(/^prt_[0-9a-f]{12}[0-9A-Za-z]{14}$/)
    expect(part.id.slice(4, 16)).toBe('bcfe56801001')
    expect(part).toMatchObject({ type: 'text', text: 'hello' })
  })

  it('sends prompt text parts to the scoped session message endpoint', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_002)
    vi.stubGlobal('crypto', { getRandomValues: fillBytes(2) })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ info: { id: 'msg_1', role: 'user', sessionID: 'ses_1' }, parts: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await sendOpenCodePrompt(config, {
      sessionID: 'ses_1',
      directory: '/Users/example/project',
      text: 'prep this work',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(url.toString()).toBe(
      'http://127.0.0.1:4096/session/ses_1/message?directory=%2FUsers%2Fexample%2Fproject',
    )
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      parts: [
        {
          id: 'prt_bcfe5680200122222222222222',
          type: 'text',
          text: 'prep this work',
        },
      ],
    })
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
    expect(new Headers(init.headers).get('Authorization')).toBe('Basic dXNlcjpwYXNz')
  })

  it('can reuse caller-provided message and part IDs for optimistic chat', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ info: { id: 'msg_given', role: 'user', sessionID: 'ses_1' }, parts: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await sendOpenCodePrompt(config, {
      sessionID: 'ses_1',
      directory: '/Users/example/project',
      text: 'prep this work',
      messageID: 'msg_given',
      part: { id: 'prt_given', type: 'text', text: 'prep this work' },
    })

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      messageID: 'msg_given',
      parts: [{ id: 'prt_given', type: 'text', text: 'prep this work' }],
    })
  })

  it('accepts empty successful prompt responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      sendOpenCodePrompt(config, {
        sessionID: 'ses_1',
        directory: '/Users/example/project',
        text: 'prep this work',
      }),
    ).resolves.toBeNull()
  })

  it('loads projects from OpenCode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 'proj_1', worktree: '/Users/example/project', sandboxes: [] }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listOpenCodeProjects(config)).resolves.toEqual([
      { id: 'proj_1', worktree: '/Users/example/project', sandboxes: [] },
    ])

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(url.toString()).toBe('http://127.0.0.1:4096/project')
    expect(new Headers(init.headers).get('Authorization')).toBe('Basic dXNlcjpwYXNz')
  })

  it('sends configured request headers with OpenCode requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 'proj_1', worktree: '/Users/example/project', sandboxes: [] }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await listOpenCodeProjects({
      ...config,
      requestHeaders: [
        { name: 'X-OpenBoard', value: 'enabled' },
        { name: 'Authorization', value: 'Bearer token' },
      ],
    })

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    const headers = new Headers(init.headers)
    expect(headers.get('X-OpenBoard')).toBe('enabled')
    expect(headers.get('Authorization')).toBe('Bearer token')
  })

  it('loads agents for the selected project directory', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ name: 'project-agent', mode: 'primary' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listOpenCodeAgents(config, { directory: '/Users/example/project' })).resolves.toEqual([
      { name: 'project-agent', mode: 'primary' },
    ])

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(url.toString()).toBe('http://127.0.0.1:4096/agent?directory=%2FUsers%2Fexample%2Fproject')
  })

  it('deletes the OpenCode session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(true), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteOpenCodeSession(config, { sessionID: 'ses_1' })).resolves.toBe(true)

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(url.toString()).toBe('http://127.0.0.1:4096/session/ses_1')
    expect(init.method).toBe('DELETE')
  })
})

function fillBytes(value: number) {
  return (bytes: Uint8Array) => {
    bytes.fill(value)
    return bytes
  }
}
