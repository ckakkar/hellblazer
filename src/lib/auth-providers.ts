/** The two ways into an account: Google everywhere, Apple in the iOS app. */
export type Provider = "google" | "apple";

export const PROVIDER_NAME: Record<Provider, string> = { google: "Google", apple: "Apple" };

/** Why connecting a provider failed, in words, from the auth server's error code. */
export function linkErrorMessage(code: string | null | undefined, provider?: Provider): string {
  const account = provider ? `That ${PROVIDER_NAME[provider]} account` : "That account";
  switch (code) {
    case "identity_already_exists":
      return `${account} already has its own Fatty account. Sign in with it and delete that account in Settings first, or connect a different one.`;
    case "manual_linking_disabled":
      return "Connecting sign-in methods isn't switched on yet. Try again later.";
    default:
      return "Couldn't connect it. Try again.";
  }
}
