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
