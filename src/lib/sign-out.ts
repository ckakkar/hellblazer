import { signOut } from "@/lib/actions/auth";
import { unlinkWatch } from "@/lib/actions/watch";
import { nativePlugin } from "@/lib/native-plugins";

/**
 * Sign out, for forms in client components. In the iOS app it first revokes
 * the watch's and the phone's device tokens, so neither the wrist nor the
 * widgets keep showing this account.
 */
export async function signOutOfApp() {
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
