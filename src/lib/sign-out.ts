import { signOut } from "@/lib/actions/auth";
import { unlinkWatch } from "@/lib/actions/watch";
import { nativePlugin } from "@/lib/native-plugins";
import { deletePushSubscription } from "@/lib/actions/push";
import { isNativeApp } from "@/lib/native";

/**
 * Sign out, for forms in client components. First this device stops getting
 * the account's notifications (its APNs token or the browser's push
 * subscription leaves it). In the iOS app it also revokes the watch's and
 * the phone's device tokens, so neither the wrist nor the widgets keep
 * showing this account. Tidying up never stops the sign-out itself.
 */
export async function signOutOfApp() {
  await forgetPush().catch(() => {});
  const plugin = nativePlugin();
  if (plugin) {
    try {
      const { api } = await plugin;
      // Each on its own: an older app has no phoneUnlink.
      const tokens = await Promise.all([
        api.watchUnlink({ disable: false }).then((r) => r.token, () => null),
        api.phoneUnlink().then((r) => r.token, () => null),
      ]);
      await Promise.all(
        tokens.filter((t): t is string => Boolean(t)).map((token) => unlinkWatch({ token })),
      );
    } catch {
      // Signing out matters more than tidying up the watch.
    }
  }
  await signOut();
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
