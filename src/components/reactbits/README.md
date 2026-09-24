# React Bits (vendored)

Components adapted from [React Bits](https://reactbits.dev) (MIT,
`DavidHDev/react-bits`), taken from the TS + Tailwind registry variants at
`public/r/<Name>-TS-TW.json`.

React Bits is a copy-paste library, not an npm package, the source lives here
so it stays readable and themeable, per CLAUDE.md's "keep it hand-built and
lean". (Note: the `react-bits` package on npm is an unrelated, abandoned
project. Do not install it.)

Local changes to every file here:

- `"use client"` for the App Router.
- Hard-coded palette values swapped for the app's CSS tokens, so these re-skin
  with `html[data-accent]` like everything else.
- `prefers-reduced-motion` respected: animation is skipped and the final state
  rendered immediately, matching the rule in `globals.css`.

Only `motion` is required; no GSAP, three.js, or OGL. Keep it that way unless
the WebGL cost is deliberately accepted.

`count-up.tsx` additionally:

- Renders the formatted target as real children when `animateOnMount={false}`,
  so a server-rendered headline figure is never blank before hydration. With
  the intro count enabled it stays empty on the server, because painting the
  final number first would make hydration snap it back to zero.
- Takes `animateOnMount`. For a value that changes while you watch it (the live
  tonnage on `/log/[id]`), the move is the information, not the arrival, so the
  spring is seeded at the current value and only runs on change.

`scroll-reveal.tsx` (a GSAP-free rebuild on `motion`'s `useScroll`),
`split-flap-text.tsx`, `spotlight-card.tsx` and `blur-text.tsx` were removed in the September
2026 redesign: the minimal UI keeps motion for things that carry information
(a live figure changing, a sheet arriving, a navigation), and those three were
decoration (the blur-in title included). They are in git history if a future screen genuinely needs one.

## Interaction pieces (September 2026)

Pulled through the shadcn MCP server's `@react-bits` registry. Each one guards
an action rather than decorating one:

| File | Upstream | Used for |
|------|----------|----------|
| `slide-commit.tsx` | SlideCommit | **Slide to finish** a live workout, so a stray tap mid-set can't end it. Resets with "Not finished" if unsaved sets or no connection stop it. |
| `hold-button.tsx` | HoldButton | **Hold to delete** a session, **hold to restart** a block, **hold to wipe** history (2 s). Replaces the two-tap "Sure?" prompts; letting go early cancels. |
| `fuse-button.tsx` | FuseButton | **Skip** with a 4 s undo: the button turns into Undo while a fuse burns in the accent, and the day is only skipped when it runs out (or you leave the page). |

Local changes, beyond the list above:

- **No Hugeicons.** Upstream imports `@hugeicons/*`; these use `lucide-react`,
  which the app already ships.
- **Namespace.** HoldButton's `hb-` classes and custom properties are renamed
  `hold-`: `hb-` is this app's own prefix, and they collided.
- **Fluid width.** SlideCommit takes an optional `width`; without it, it fills
  its container (ResizeObserver) so it can span a phone.
- **No bounce.** SlideCommit's `returnBounce` and `landingDip` default to 0,
  per the design rule against springy motion.
- **Accent-aware.** Colours default to the app's tokens, and anything drawn in
  the accent takes `rgb(var(--accent-rgb))`. Because that isn't a hex,
  SlideCommit takes an explicit `successTextColor`.
- **Lint.** The "latest callback" refs they update during render now update in
  an effect, which is what the React hooks lint rules require.

Only SlideCommit needs `motion`, and it's used in the logger, which loads
`motion` for CountUp anyway. HoldButton's frame loop runs only while a press is
held; FuseButton's fuse is a Web Animation.
