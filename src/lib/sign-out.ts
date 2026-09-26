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
      const [watch, phone] = await Promise.all([api.watchUnlink({ disable: false }), api.phoneUnlink()]);
      await Promise.all(
        [watch.token, phone.token].filter((t): t is string => Boolean(t)).map((token) => unlinkWatch({ token })),
      );
    } catch {
      // Signing out matters more than tidying up the watch.
    }
  }
  await signOut();
}
