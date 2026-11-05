/**
 * Runs a server action, and once more when its request died at once
 * without an answer. A phone's network drops a connection that sat idle for
 * a while (between sets, say) without telling it, and the next request on it
 * fails straight away. iOS re-sends a page or data request (a GET) on a
 * fresh connection by itself, but never a POST, and every server action is
 * a POST: so the first tap after a rest failed ("Couldn't start the
 * workout") while the error report sent a moment later went through.
 *
 * Only for an action that does the same thing sent twice: a failure can
 * also be an answer lost on its way back, after the server did the work.
 * Starting a workout is (one already under way wins), and so is finishing
 * one (its first finish time stays). Adding an exercise, making a template
 * or moving a row is not: never wrap those. And only a failure within a few
 * seconds, with a network error, while the phone says it's online: one that
 * hung for long may well have landed, and tapping again stays the lifter's
 * call.
 */

const RESEND_WINDOW_MS = 4_000;

export async function sendAgainIfDropped<T>(action: () => Promise<T>): Promise<T> {
  const began = Date.now();
  try {
    return await action();
  } catch (err) {
    const dropped = err instanceof TypeError && navigator.onLine && Date.now() - began < RESEND_WINDOW_MS;
    if (!dropped) throw err;
    return action();
  }
}
