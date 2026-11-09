/**
 * React Bits' ScrollStack, on CSS sticky + view timelines: each card pins as
 * it reaches the top and the ones under it settle back (smaller, dimmer) as
 * the next slides over, a dimmed deck. STUB: a plain column; the partner
 * builds the motion.
 */
export function ScrollStack({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function ScrollStackItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
