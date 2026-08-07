import { ArenaLoader } from "@/components/ui/arena-loader";

/**
 * Fallback route loader. Every browsing screen now ships its own layout-shaped
 * skeleton (see the sibling `loading.tsx` files), which reads as the page
 * arriving rather than the app blanking out. What's left here is `/log` and
 * `/log/[id]`: stepping into a workout is the one navigation where a full
 * match-loading takeover is the point, not an interruption.
 */
export default function Loading() {
  return <ArenaLoader />;
}
