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
- **Live updates** — while the panel is open, it rescans automatically as
  the file changes (debounced, so a burst of edits doesn't spam rescans) and
  the green dot next to the count pulses on each update.
- **Instant heads-up** — the moment anyone places an instance of a component
  you've marked deprecated (or one that's missing), Figma shows a toast right
  then, instead of only surfacing it the next time someone runs a scan.
- Filter the list by component name — useful once a file has dozens of
  components in use.

Note: "live" means live *while the plugin panel is open* — Figma plugins
don't run persistently in the background when closed (that's what Widgets
are for, a different extension type). Reopen the panel to pick back up.

- **Change history** — click **History** to see a running log of what got
  created, deleted, moved between pages, or (un)deprecated, with a
  timestamp for each. Click **Download .md** to save it as a file — hand it
  to a developer so they can see exactly what changed without opening
  Figma. History is stored in the file itself (`setPluginData` on the
  document), so it persists across sessions and is visible to your whole
  team, not just your machine. Deletions/moves are only logged for nodes
  Sentinel has already seen (from a scan, or created while the panel was
  open) — it can't describe something it never observed existing.

This isn't a general design-system linter (hardcoded colors, detached
instances, drift detection — tools like ComponentQA already cover that well).
It's specifically for the deprecation/retirement workflow those tools don't
touch.

## Using it

1. In Figma: **Plugins → Development → Import plugin from manifest…**
2. Select `manifest.json` from this folder
3. Run **Plugins → Development → Component Sentinel** — it scans automatically on open

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
