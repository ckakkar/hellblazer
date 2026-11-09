/**
 * React Bits' ScrollExpand, on a CSS view timeline: a rounded, inset frame
 * that grows to full bleed as it scrolls through the screen. STUB: the
 * frame at full size; the partner builds the motion.
 */
export function ScrollExpand({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
