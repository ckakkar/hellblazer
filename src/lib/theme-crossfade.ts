/**
 * Re-skins the page (appearance, accent) as one crossfade of the whole
 * screen, the anchored chrome included (`html[data-theming]` in
 * globals.css), instead of flipping in a frame. Straight away where there
 * are no view transitions, or with reduced motion.
 */
export function crossfadeTheme(flip: () => void) {
  const root = document.documentElement;
  if (typeof document.startViewTransition !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    flip();
    return;
  }
  root.dataset.theming = "";
  void document
    .startViewTransition(flip)
    .finished.finally(() => delete root.dataset.theming);
}
