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
const dbVersion = 1
const prepSessionStore = 'prepSessions'

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
    }

    request.onerror = () => reject(request.error ?? new Error('Unable to open OpenBoard database.'))
    request.onsuccess = () => resolve(request.result)
  })
}

async function transaction<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
) {
  const database = await openDatabase()

  return new Promise<T>((resolve, reject) => {
    const tx = database.transaction(prepSessionStore, mode)
    const store = tx.objectStore(prepSessionStore)
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
  const sessions = await transaction<OpenBoardPrepSession[]>('readonly', (store) => store.getAll())

  return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function savePrepSession(session: OpenBoardPrepSession) {
  await transaction<IDBValidKey>('readwrite', (store) => store.put(session))
  return session
}

export function createPrepSessionId() {
  return `prep_${Date.now().toString(36)}_${crypto.randomUUID()}`
}
