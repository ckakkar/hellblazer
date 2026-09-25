/**
 * Pages pushed onto a stack, where iOS offers the edge swipe back: a session
 * from History, a program, the legal pages from Settings. Tab roots and the
 * live logger don't (a stray swipe mid-set shouldn't leave the workout).
 */
export function isPushedRoute(pathname: string): boolean {
  return (
    /^\/history\/[^/]+$/.test(pathname) ||
    /^\/programs\/[^/]+$/.test(pathname) ||
    pathname === "/privacy" ||
    pathname === "/support"
  );
}
