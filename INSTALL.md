# Installing Component Sentinel

Component Sentinel isn't listed on Figma's public plugin store — it runs as a
private plugin, which just means you load it yourself, once. Takes about a
minute.

## Figma desktop app

1. Unzip this download somewhere you'll keep it (don't delete the folder
   afterward — Figma reads the plugin from it every time you run it).
2. Open Figma and open any file.
3. Click the **Figma menu** in the top-left corner → **Plugins** →
   **Development** → **Import plugin from manifest…**
4. In the file picker, select the `manifest.json` file inside the folder you
   unzipped.
5. That's it. Run it anytime from **Plugins → Development → Component
   Sentinel**.

## Using it

- **Plugins → Development → Component Sentinel → Scan file** — scans the
  whole file (every page) and lists every component in use, sorted so
  anything missing or deprecated shows up first.
- Click **Select all** on any row to jump straight to those instances, even
  if they're on a different page.
- To flag a component as deprecated: select the component (or component set)
  on the canvas, and a panel appears at the bottom of the plugin letting you
  mark it and add a short reason — anyone else who runs Sentinel will see it.
- **Copy report as Markdown / Copy as JSON** — at the top of the panel, these
  copy a full report (with direct links to every flagged instance) to your
  clipboard. Paste the Markdown into a Slack message, ticket, or PR
  description so a developer can see exactly what's changing without
  installing the plugin themselves.

## Updating

If you get a new version, unzip it over the same folder (or a new one) and
re-import — no need to remove the old install first, Figma just points at
whichever manifest.json you last imported.

## Questions or bugs

Reply to the Gumroad order email and I'll get back to you.
