"use client";

import { useSyncExternalStore } from "react";
import { isNativeApp } from "@/lib/native";
import { AppleSignIn } from "@/components/auth/apple-sign-in";
import { GoogleSignIn } from "@/components/auth/google-sign-in";

const noop = () => () => {};

/**
 * Google everywhere; Apple too inside the iOS app, listed first. The server
 * renders the website's version, and the app swaps Apple in on hydration.
 */
export function SignInOptions({ next }: { next?: string }) {
  const inApp = useSyncExternalStore(noop, isNativeApp, () => false);
  if (!inApp) return <GoogleSignIn next={next} />;
  return (
    <div className="grid gap-3">
      <AppleSignIn next={next} />
      <GoogleSignIn next={next} />
    </div>
  );
}
