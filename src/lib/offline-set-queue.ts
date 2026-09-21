const DB_NAME = "hell-blazer-offline";
const DB_VERSION = 1;
const STORE = "pending-sets";

export type PendingSetWrite = {
  id: string;
  sessionId: string;
  sessionExerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
  /** Write stamp from {@link nextStamp}; orders edits to the same set. */
  updatedAt: number;
  /** A queued delete: the set was removed but the server hasn't confirmed it. */
  deleted?: boolean;
};

let lastStamp = 0;

/**
 * Strictly increasing write stamp. Two edits inside one millisecond still get
 * distinct, ordered stamps, which {@link removeQueuedSet} relies on.
 */
export function nextStamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("sessionId", "sessionId");
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openQueue();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    let result: T;

    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function queueSet(write: PendingSetWrite) {
  if (typeof indexedDB === "undefined") return;
  await transaction("readwrite", (store) => store.put(write));
}

/**
 * Drop a set's queued write once the server has it. Pass the stamp of the
 * write that was uploaded as `upTo`: an edit queued while that upload was in
 * flight carries a newer stamp and is kept, because if its own upload then
 * fails, the device copy is the only one left. Omit `upTo` to drop the entry
 * whatever it holds (the set's exercise was removed, say).
 */
export async function removeQueuedSet(id: string, upTo?: number) {
  if (typeof indexedDB === "undefined") return;
  const db = await openQueue();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const current = request.result as PendingSetWrite | undefined;
      if (current && (upTo === undefined || current.updatedAt <= upTo)) {
        store.delete(id);
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getQueuedSets(sessionId: string) {
  if (typeof indexedDB === "undefined") return [] as PendingSetWrite[];
  const writes = await transaction<PendingSetWrite[]>("readonly", (store) =>
    store.index("sessionId").getAll(sessionId),
  );
  return writes.toSorted(
    (a, b) => a.setNumber - b.setNumber || a.updatedAt - b.updatedAt,
  );
}
