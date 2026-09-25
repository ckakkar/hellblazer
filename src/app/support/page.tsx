import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Support",
  description: "Help with Fatty, and how to get in touch.",
};

export default function SupportPage() {
  return (
    <LegalPage title="Support">
      <p className="text-text">
        Stuck, found a bug, or have an idea? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and you&apos;ll get a reply from
        the person who builds Fatty.
      </p>

      <section>
        <h2>Signing in</h2>
        <p>
          Fatty uses Google on the website, and Google or Apple in the iPhone app. Signing in with
          the same email on both gives you one account. With Apple&apos;s Hide My Email you get a
          separate account.
        </p>
      </section>

      <section>
        <h2>Logging without signal</h2>
        <p>
          Sets you log with no connection are saved on your phone and upload when you&apos;re back
          online. Keep the app open until they&apos;re sent before you finish the session.
        </p>
      </section>

      <section>
        <h2>Notifications</h2>
        <p>
          Turn them on in Settings → Notifications. In the iPhone app, if you said no to the prompt
          earlier, allow them in iOS Settings → Notifications → Fatty. On the website, iPhones only
          get notifications after you add Fatty to the Home Screen.
        </p>
      </section>

      <section>
        <h2>Rest timer, widgets and Apple Health</h2>
        <p>
          In the iPhone app, a running rest shows on the Lock Screen and in the Dynamic Island, with
          an alert when it&apos;s over. Add the Fatty widget from the Home Screen or Lock Screen
          editor. Apple Health sync is in Settings.
        </p>
      </section>

      <section>
        <h2>Deleting your account</h2>
        <p>
          Settings → Delete account removes your account and all your data immediately. See{" "}
          <Link href="/privacy">Privacy</Link> for what Fatty stores.
        </p>
      </section>
    </LegalPage>
  );
}
