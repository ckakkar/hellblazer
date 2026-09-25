import { signOut } from "@/lib/actions/auth";
import { unlinkWatch } from "@/lib/actions/watch";
import { nativePlugin } from "@/lib/native-plugins";

/**
 * Sign out, for forms in client components. In the iOS app it first
 * disconnects the Apple Watch, so the wrist stops showing this account.
 */
export async function signOutOfApp() {
  const plugin = nativePlugin();
  if (plugin) {
    try {
      const { api } = await plugin;
      const { token } = await api.watchUnlink({ disable: false });
      if (token) await unlinkWatch({ token });
    } catch {
      // Signing out matters more than tidying up the watch.
    }
  }
  await signOut();
}
