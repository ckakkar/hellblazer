import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  getQueuedSets,
  queueSet,
  removeQueuedSet,
  type PendingSetWrite,
} from "./offline-set-queue";

const DB_NAME = "hell-blazer-offline";

function write(
  id: string,
  sessionId: string,
  setNumber: number,
  weightKg = 100,
): PendingSetWrite {
  return {
    id,
    sessionId,
    sessionExerciseId: "exercise-1",
    setNumber,
    weightKg,
    reps: 5,
    rpe: 8,
    isWarmup: false,
    updatedAt: setNumber,
  };
}

async function deleteDatabase() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

afterEach(deleteDatabase);

describe("offline set queue", () => {
  it("isolates sessions and restores sets in set order", async () => {
    await queueSet(write("second", "session-a", 2));
    await queueSet(write("other", "session-b", 1));
    await queueSet(write("first", "session-a", 1));

    expect((await getQueuedSets("session-a")).map((set) => set.id)).toEqual([
      "first",
      "second",
    ]);
  });

  it("keeps only the latest values for a set id", async () => {
    await queueSet(write("same", "session-a", 1, 100));
    await queueSet(write("same", "session-a", 1, 112.5));

    expect(await getQueuedSets("session-a")).toMatchObject([
      { id: "same", weightKg: 112.5 },
    ]);
  });

  it("removes a set after a successful upload", async () => {
    await queueSet(write("done", "session-a", 1));
    await removeQueuedSet("done");

    expect(await getQueuedSets("session-a")).toEqual([]);
  });
});
