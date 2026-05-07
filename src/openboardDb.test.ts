import fakeIndexedDB from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deletePrepSession, listCards, listPrepSessions, saveCard, saveCards, savePrepSession, type OpenBoardPrepSession } from './openboardDb'
import type { Card } from './app/types'

const session: OpenBoardPrepSession = {
  id: 'prep_1',
  title: 'Test prep session',
  projectDirectory: '/Users/example/project',
  opencodeSessionId: 'ses_1',
  createdAt: 1,
  updatedAt: 2,
  status: 'prepping',
}

const card: Card = {
  id: 'prep_1',
  title: 'Test card',
  prompt: 'Move this work forward',
  status: 'plan',
  agent: 'plan',
}

describe('openboardDb', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', fakeIndexedDB)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('removes deleted prep sessions from IndexedDB', async () => {
    await savePrepSession(session)
    await expect(listPrepSessions()).resolves.toEqual([session])

    await deletePrepSession(session.id)

    await expect(listPrepSessions()).resolves.toEqual([])
  })

  it('persists board cards in IndexedDB', async () => {
    await saveCard(card)

    await expect(listCards()).resolves.toEqual([card])
  })

  it('persists multiple board cards in one transaction', async () => {
    const buildCard: Card = { ...card, id: 'prep_2', status: 'build' }

    await saveCards([card, buildCard])

    await expect(listCards()).resolves.toEqual([card, buildCard])
  })
})
