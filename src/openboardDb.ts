import type { Card } from './app/types'

export type OpenBoardPrepSession = {
  id: string
  title: string
  projectDirectory: string
  opencodeSessionId: string
  createdAt: number
  updatedAt: number
  status: 'prepping' | 'delegated' | 'archived'
}

const dbName = 'openboard'
const dbVersion = 2
const prepSessionStore = 'prepSessions'
const cardStore = 'cards'
let prepSessionIdCounter = 0

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(prepSessionStore)) {
        const store = database.createObjectStore(prepSessionStore, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
        store.createIndex('opencodeSessionId', 'opencodeSessionId', { unique: true })
      }

      if (!database.objectStoreNames.contains(cardStore)) {
        const store = database.createObjectStore(cardStore, { keyPath: 'id' })
        store.createIndex('status', 'status')
      }
    }

    request.onerror = () => reject(request.error ?? new Error('Unable to open OpenBoard database.'))
    request.onsuccess = () => resolve(request.result)
  })
}

async function transaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
) {
  const database = await openDatabase()

  return new Promise<T>((resolve, reject) => {
    const tx = database.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const request = callback(store)
    let result = undefined as T

    if (request) {
      request.onsuccess = () => {
        result = request.result
      }
      request.onerror = () => reject(request.error ?? new Error('OpenBoard database request failed.'))
    }

    tx.oncomplete = () => {
      database.close()
      resolve(result)
    }
    tx.onerror = () => {
      database.close()
      reject(tx.error ?? new Error('OpenBoard database transaction failed.'))
    }
  })
}

export async function listPrepSessions() {
  const sessions = await transaction<OpenBoardPrepSession[]>(prepSessionStore, 'readonly', (store) => store.getAll())

  return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function savePrepSession(session: OpenBoardPrepSession) {
  await transaction<IDBValidKey>(prepSessionStore, 'readwrite', (store) => store.put(session))
  return session
}

export async function deletePrepSession(id: string) {
  await transaction<undefined>(prepSessionStore, 'readwrite', (store) => store.delete(id))
}

export async function listCards() {
  return transaction<Card[]>(cardStore, 'readonly', (store) => store.getAll())
}

export async function saveCard(card: Card) {
  await transaction<IDBValidKey>(cardStore, 'readwrite', (store) => store.put(card))
  return card
}

export async function saveCards(cards: Card[]) {
  const database = await openDatabase()

  return new Promise<Card[]>((resolve, reject) => {
    const tx = database.transaction(cardStore, 'readwrite')
    const store = tx.objectStore(cardStore)

    cards.forEach((card) => store.put(card))

    tx.oncomplete = () => {
      database.close()
      resolve(cards)
    }
    tx.onerror = () => {
      database.close()
      reject(tx.error ?? new Error('OpenBoard database transaction failed.'))
    }
  })
}

export function createPrepSessionId() {
  prepSessionIdCounter = (prepSessionIdCounter + 1) % 0x1000

  return `prep_${Date.now().toString(36)}_${prepSessionIdCounter.toString(36)}_${randomIdSegment(18)}`
}

function randomIdSegment(length: number) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz'
  const cryptoObject = globalThis.crypto

  if (cryptoObject?.getRandomValues) {
    const bytes = new Uint8Array(length)
    cryptoObject.getRandomValues(bytes)

    return Array.from(bytes, (byte) => chars[byte % chars.length]).join('')
  }

  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
