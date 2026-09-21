import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  getQueuedSets,
  nextStamp,
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

  it("removes the uploaded write when nothing newer was queued", async () => {
    const uploaded = { ...write("same", "session-a", 1), updatedAt: nextStamp() };
    await queueSet(uploaded);
    await removeQueuedSet("same", uploaded.updatedAt);

    expect(await getQueuedSets("session-a")).toEqual([]);
  });

  it("keeps an edit queued while an older upload was in flight", async () => {
    // Upload of 100kg starts; the lifter corrects it to 102.5kg before it lands.
    const uploading = { ...write("same", "session-a", 1, 100), updatedAt: nextStamp() };
    await queueSet(uploading);
    const edited = { ...write("same", "session-a", 1, 102.5), updatedAt: nextStamp() };
    await queueSet(edited);

    // The 100kg upload succeeds. Its cleanup must not take the newer edit.
    await removeQueuedSet("same", uploading.updatedAt);

    expect(await getQueuedSets("session-a")).toMatchObject([
      { id: "same", weightKg: 102.5 },
    ]);
  });

  it("stamps strictly increase within one millisecond", () => {
    const stamps = Array.from({ length: 5 }, () => nextStamp());
    for (let i = 1; i < stamps.length; i++) {
      expect(stamps[i]).toBeGreaterThan(stamps[i - 1]);
    }
  });

  it("queues deletes alongside writes", async () => {
    await queueSet({ ...write("gone", "session-a", 0), deleted: true });

    expect(await getQueuedSets("session-a")).toMatchObject([
      { id: "gone", deleted: true },
    ]);
  });
});
