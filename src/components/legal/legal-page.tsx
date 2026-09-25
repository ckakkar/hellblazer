import Link from "next/link";
import { Flame } from "lucide-react";

export const CONTACT_EMAIL = "cyrus@kkrwhofrags.xyz";

/** The shared frame for the public Privacy and Support pages. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  /** e.g. "25 September 2026" */
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-bg px-5 pb-[calc(env(safe-area-inset-bottom)+3rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2 text-text">
          <Flame className="size-5 text-accent" strokeWidth={2.25} />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">Fatty</span>
        </Link>
        <h1 className="font-display mt-10 text-[2.5rem] leading-tight text-text">{title}</h1>
        {updated && <p className="mt-2 text-[13px] text-muted">Updated {updated}</p>}
        <div className="mt-8 grid gap-8 text-[15px] leading-7 text-muted [&_a]:text-text [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mb-2 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-text [&_li]:mt-1.5 [&_strong]:font-medium [&_strong]:text-text [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </div>
    </main>
  );
}
