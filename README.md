# Component Sentinel

Answers the question every design-system owner eventually hits: **"we want to
retire this component — who's still using it?"**

Mark a component deprecated with a reason, and Component Sentinel finds every
instance still using it, across every page in the file. It also catches
**missing components** — instances whose main component no longer resolves
(deleted, or removed from a library).

- Real usage counts per component, across the whole file
- Click any row to jump straight to those instances, even across pages
- **Export a report as Markdown or JSON**, with direct links to each flagged
  instance — so an engineer can see exactly what's being retired without
  installing the plugin themselves. Paste the Markdown into a PR description,
  a ticket, or Slack; pipe the JSON into a script.

This isn't a general design-system linter (hardcoded colors, detached
instances, drift detection — tools like ComponentQA already cover that well).
It's specifically for the deprecation/retirement workflow those tools don't
touch.

## Using it

1. In Figma: **Plugins → Development → Import plugin from manifest…**
2. Select `manifest.json` from this folder
3. Run **Plugins → Development → Component Sentinel → Scan file**

To mark a component deprecated, select it (or its component set) on the
canvas — a panel appears at the bottom of the plugin letting you flag it and
add a short reason. Use **Copy report as Markdown** or **Copy as JSON** at
the top of the panel to hand the results to someone else.

## Development

```
npm install
npm run build     # compiles src/code.ts -> src/code.js
```

`npm run watch` recompiles on save. Reload the plugin in Figma
(right-click the running plugin → re-run, or close/reopen it) to pick up
changes — Figma does not hot-reload the sandbox code automatically.
