import "./scroll-motion.css";

/** One clipped frame opens from an inset poster to the full page width. */
export function ScrollExpand({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rb-scroll-expand ${className}`}><div className="rb-expand-frame">{children}</div></div>;
}
