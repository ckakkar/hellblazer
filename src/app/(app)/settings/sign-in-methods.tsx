"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { SettingsGroup, SettingsRow } from "@/components/ui/settings-list";
import { createClient } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/native";
import { linkErrorMessage, PROVIDER_NAME, type Provider } from "@/lib/auth-providers";

const noop = () => () => {};

export type SignInMethod = { connected: boolean; email: string | null };

/**
 * Google and Apple as ways into the same account. Connect the other one and
 * either signs you in from then on. Google connects anywhere (a redirect on
 * the website, Google's sheet in the app); Apple connects in the iOS app,
 * where Sign in with Apple lives.
 */
export function SignInMethods({
  methods,
  linkError,
}: {
  methods: Record<Provider, SignInMethod>;
  /** An error code from a website link attempt that came back through /auth/callback. */
  linkError?: string;
}) {
  const inApp = useSyncExternalStore(noop, isNativeApp, () => false);
  const router = useRouter();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [msg, setMsg] = useState<string | null>(linkError ? linkErrorMessage(linkError, "google") : null);

  async function connect(provider: Provider) {
    setMsg(null);
    setBusy(provider);
    try {
      if (inApp) {
        const { linkInApp } = await import("@/lib/native-auth");
        const result = await linkInApp(provider);
        if (result.ok) router.refresh();
        else setMsg(result.message);
        return;
      }
      // Website: Google's usual redirect, back to Settings via /auth/callback.
      const { error } = await createClient().auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/settings")}`,
        },
      });
      if (error) setMsg(linkErrorMessage(error.code, "google"));
    } catch {
      setMsg("Couldn't connect it. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const row = (provider: Provider) => {
    const { connected, email } = methods[provider];
    const canConnect = provider === "google" || inApp;
    const hint = connected
      ? email?.endsWith("@privaterelay.appleid.com")
        ? "Hidden email (Hide My Email)"
        : (email ?? "Connected")
      : canConnect
        ? "Not connected"
        : "Connect it from the Fatty iPhone app";
    return (
      <SettingsRow
        key={provider}
        label={PROVIDER_NAME[provider]}
        hint={hint}
        control={
          connected ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
              <Check className="size-4 text-text" /> Connected
            </span>
          ) : canConnect ? (
            <button
              type="button"
              onClick={() => connect(provider)}
              disabled={busy !== null}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-surface-2 px-3.5 text-[14px] font-medium text-text transition-colors hover:bg-[#242428] disabled:opacity-60"
            >
              {busy === provider && <Loader2 className="size-4 animate-spin" />}
              Connect
            </button>
          ) : undefined
        }
      />
    );
  };

  return (
    <SettingsGroup
      label="Sign-in methods"
      caption={
        msg ??
        "Connect both and either one signs you in. Accounts that share an email connect on their own."
      }
    >
      {row("apple")}
      {row("google")}
    </SettingsGroup>
  );
}
