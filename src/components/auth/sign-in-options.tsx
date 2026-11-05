"use client";

import { useInApp } from "@/components/in-app";
import { AppleSignIn } from "@/components/auth/apple-sign-in";
import { GoogleSignIn } from "@/components/auth/google-sign-in";

/**
 * Google everywhere; Apple too inside the iOS app, listed first (the server
 * knows the app from its user agent, so Apple is there from the first paint).
 * `webNote` is said on the website only (where there's no Apple button).
 */
export function SignInOptions({ next, webNote }: { next?: string; webNote?: React.ReactNode }) {
  const inApp = useInApp();
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
