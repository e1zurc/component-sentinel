# Component Sentinel

A Figma plugin for design-system owners. It scans an entire file for every
component instance and tells you:

- **Missing components** — instances whose main component no longer resolves
  (e.g. removed from a library)
- **Deprecated components** — components you've explicitly flagged, with a
  reason, so anyone using them sees why and what replaces them
- **Real usage counts** — every component ranked by how many instances exist,
  across every page, so you know what's actually safe to delete or change

Click any row to jump straight to those instances, even across pages.

## Using it

1. In Figma: **Plugins → Development → Import plugin from manifest…**
2. Select `manifest.json` from this folder
3. Run **Plugins → Development → Component Sentinel → Scan file**

To mark a component deprecated, select it (or its component set) on the
canvas — a panel appears at the bottom of the plugin letting you flag it and
add a short reason.

## Development

```
npm install
npm run build     # compiles src/code.ts -> src/code.js
```

`npm run watch` recompiles on save. Reload the plugin in Figma
(right-click the running plugin → re-run, or close/reopen it) to pick up
changes — Figma does not hot-reload the sandbox code automatically.
