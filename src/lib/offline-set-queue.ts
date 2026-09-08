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
  updatedAt: number;
};

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

export async function removeQueuedSet(id: string) {
  if (typeof indexedDB === "undefined") return;
  await transaction("readwrite", (store) => store.delete(id));
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
