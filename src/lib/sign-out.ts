import { signOut } from "@/lib/actions/auth";
import { unlinkWatch } from "@/lib/actions/watch";
import { nativePlugin } from "@/lib/native-plugins";
import { deletePushSubscription } from "@/lib/actions/push";
import { isNativeApp } from "@/lib/native";

/**
 * Sign out, for forms in client components. First this device forgets the
 * account (forgetThisDevice), then the session ends. Tidying up never stops
 * the sign-out itself.
 */
export async function signOutOfApp() {
  await forgetThisDevice();
  await signOut();
}

/**
 * Everything of the account that lives on this device goes: its
 * notifications (the APNs token or the browser's push subscription), and in
 * the iOS app the watch's and the phone's device tokens, revoked on the
 * server while the session can still do it, which also clears the widgets,
 * Spotlight and the watch. Run before signing out and before deleting the
 * account. Never throws.
 */
export async function forgetThisDevice() {
  await forgetPush().catch(() => {});
  const plugin = nativePlugin();
  if (plugin) {
    try {
      const { api } = await plugin;
      void api.endWorkoutActivity().catch(() => {});
      // Each on its own: an older app has no phoneUnlink.
      const tokens = await Promise.all([
        api.watchUnlink({ disable: false }).then((r) => r.token, () => null),
        api.phoneUnlink().then((r) => r.token, () => null),
      ]);
      // A failed revoke gets one more try.
      await Promise.all(
        tokens
          .filter((t): t is string => Boolean(t))
          .map((token) => unlinkWatch({ token }).catch(() => unlinkWatch({ token }))),
      );
    } catch {
      // Signing out matters more than tidying up the watch.
    }
  }
}

async function forgetPush() {
  if (isNativeApp()) {
    const { forgetNativePush } = await import("@/lib/native-push");
    return forgetNativePush();
  }
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await deletePushSubscription({ endpoint: sub.endpoint });
  await sub.unsubscribe();
}
