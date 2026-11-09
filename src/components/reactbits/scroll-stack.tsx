import { Children, useId, type CSSProperties, type ReactNode } from "react";
import "./scroll-motion.css";

/** Content-sized sticky cards; each settles against the NEXT card's timeline. */
export function ScrollStack({ children, className = "" }: { children: ReactNode; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const cards = Children.toArray(children);
  const names = cards.map((_, i) => `--rb-stack-${id}-${i}`);
  return (
    <div className={`rb-scroll-stack ${className}`} style={{ timelineScope: names.join(", ") } as CSSProperties}>
      {cards.map((card, i) => (
        <div key={names[i]} className="rb-stack-slot" data-covered={i < cards.length - 1 ? "true" : undefined} style={{ "--stack-i": i, "--stack-after": cards.length - i - 1, "--stack-next": names[i + 1] ?? "none", viewTimelineName: names[i] } as CSSProperties}>
          <div className="rb-stack-surface">{card}</div>
        </div>
      ))}
    </div>
  );
}

export function ScrollStackItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rb-stack-content ${className}`}>{children}</div>;
}
