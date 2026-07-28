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
