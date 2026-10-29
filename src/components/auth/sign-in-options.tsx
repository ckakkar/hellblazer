"use client";

import { useSyncExternalStore } from "react";
import { isNativeApp } from "@/lib/native";
import { AppleSignIn } from "@/components/auth/apple-sign-in";
import { GoogleSignIn } from "@/components/auth/google-sign-in";

const noop = () => () => {};

/**
 * Google everywhere; Apple too inside the iOS app, listed first. The server
 * renders the website's version, and the app swaps Apple in on hydration.
 * `webNote` is said on the website only (where there's no Apple button).
 */
export function SignInOptions({ next, webNote }: { next?: string; webNote?: React.ReactNode }) {
  const inApp = useSyncExternalStore(noop, isNativeApp, () => false);
  if (!inApp)
    return (
      <>
        <GoogleSignIn next={next} />
        {webNote}
      </>
    );
  return (
    <div className="grid grid-cols-1 gap-3">
      <AppleSignIn next={next} />
      <GoogleSignIn next={next} />
    </div>
  );
}
