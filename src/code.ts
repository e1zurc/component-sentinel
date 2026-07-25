// Component Sentinel — finds every instance of a deleted or deprecated
// component across the whole file, and ranks components by real usage.

const DEPRECATED_KEY = 'sentinel-deprecated'
const DEPRECATED_REASON_KEY = 'sentinel-deprecated-reason'
const HISTORY_KEY = 'sentinel-history'
const MAX_HISTORY_ENTRIES = 400

interface HistoryEntry {
  ts: string
  type: 'created' | 'deleted' | 'moved' | 'deprecated' | 'undeprecated'
  name: string
  kind: string
  pageName: string
  detail: string
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = figma.root.getPluginData(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

function appendHistory(entry: Omit<HistoryEntry, 'ts'>) {
  const history = loadHistory()
  history.push({ ts: new Date().toISOString(), ...entry })
  while (history.length > MAX_HISTORY_ENTRIES) history.shift()
  figma.root.setPluginData(HISTORY_KEY, JSON.stringify(history))
  // Keep an already-open history panel live, same as the scan results.
  figma.ui.postMessage({ type: 'history-result', entries: history })
}

// Tracks nodes Sentinel has already seen (name/kind/page) so that when a
// DELETE change arrives — which gives only an id, no snapshot of what was
// there — we can still describe what got deleted. Only covers nodes seen
// during a scan or created while the panel was open, in this session.
const nodeCache = new Map<string, { name: string; kind: string; pageName: string }>()

interface ComponentRow {
  componentKey: string
  name: string
  status: 'ok' | 'deprecated' | 'missing'
  reason: string
  count: number
  pages: { pageId: string; pageName: string; nodeIds: string[]; url: string | null }[]
}

interface InstanceRef {
  nodeId: string
  pageId: string
  pageName: string
}

function isDeprecated(component: ComponentNode | null): { deprecated: boolean; reason: string } {
  if (!component) return { deprecated: false, reason: '' }
  const self = component.getPluginData(DEPRECATED_KEY)
  if (self === 'true') {
    return { deprecated: true, reason: component.getPluginData(DEPRECATED_REASON_KEY) || '' }
  }
  const parent = component.parent
  if (parent && parent.type === 'COMPONENT_SET') {
    const setNode = parent as ComponentSetNode
    if (setNode.getPluginData(DEPRECATED_KEY) === 'true') {
      return { deprecated: true, reason: setNode.getPluginData(DEPRECATED_REASON_KEY) || '' }
    }
  }
  return { deprecated: false, reason: '' }
}

async function scan(): Promise<ComponentRow[]> {
  await figma.loadAllPagesAsync()
  const instances = figma.root.findAllWithCriteria({ types: ['INSTANCE'] }) as InstanceNode[]

  const rows = new Map<string, ComponentRow>()

  for (const instance of instances) {
    let main: ComponentNode | null = null
    try {
      main = await instance.getMainComponentAsync()
    } catch {
      main = null
    }
    // A deleted component's node object still resolves (with its last-known
    // name) instead of coming back null — `.removed` is the real signal.
    if (main && main.removed) main = null

    const page = instance.parent ? findPage(instance) : null
    const pageId = page ? page.id : 'unknown'
    const pageName = page ? page.name : 'Unknown page'

    nodeCache.set(instance.id, { name: instance.name, kind: 'instance', pageName })
    if (main) {
      const mainPage = findPage(main)
      nodeCache.set(main.id, { name: displayName(main), kind: 'component', pageName: mainPage ? mainPage.name : pageName })
    }

    const key = main ? main.key || main.id : `missing:${instance.id}`
    const dep = isDeprecated(main)

    let row = rows.get(key)
    if (!row) {
      row = {
        componentKey: key,
        name: main ? displayName(main) : `Missing component (was "${instance.name}")`,
        status: !main ? 'missing' : dep.deprecated ? 'deprecated' : 'ok',
        reason: dep.reason,
        count: 0,
        pages: [],
      }
      rows.set(key, row)
    }
    row.count += 1

    let pageEntry = row.pages.find((p) => p.pageId === pageId)
    if (!pageEntry) {
      pageEntry = { pageId, pageName, nodeIds: [], url: buildNodeUrl(instance.id) }
      row.pages.push(pageEntry)
    }
    pageEntry.nodeIds.push(instance.id)
  }

  return Array.from(rows.values()).sort((a, b) => {
    const rank = { missing: 0, deprecated: 1, ok: 2 }
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
    return b.count - a.count
  })
}

function buildNodeUrl(nodeId: string): string | null {
  if (!figma.fileKey) return null
  const urlNodeId = nodeId.replace(/:/g, '-')
  return `https://www.figma.com/file/${figma.fileKey}/${encodeURIComponent(figma.root.name)}?type=design&node-id=${urlNodeId}`
}

function displayName(component: ComponentNode): string {
  const parent = component.parent
  if (parent && parent.type === 'COMPONENT_SET') {
    return `${parent.name} / ${component.name}`
  }
  return component.name
}

function findPage(node: BaseNode): PageNode | null {
  let current: BaseNode | null = node
  while (current) {
    if (current.type === 'PAGE') return current as PageNode
    current = current.parent
  }
  return null
}

async function generateTestFixture(): Promise<void> {
  const page = figma.currentPage
  const created: SceneNode[] = []

  function solid(r: number, g: number, b: number): Paint[] {
    return [{ type: 'SOLID', color: { r, g, b } }]
  }

  // Healthy, well-used component
  const button = figma.createComponent()
  button.name = 'Primary Button'
  page.appendChild(button)
  button.resize(120, 40)
  button.fills = solid(0.48, 0.38, 1)
  button.x = 0
  button.y = 0
  created.push(button)
  for (let i = 0; i < 4; i++) {
    const inst = button.createInstance()
    page.appendChild(inst)
    inst.x = 160 * (i + 1)
    inst.y = 0
    created.push(inst)
  }

  // Deprecated component, still referenced in a couple of places
  const oldCard = figma.createComponent()
  oldCard.name = 'Old Card'
  page.appendChild(oldCard)
  oldCard.resize(200, 120)
  oldCard.fills = solid(0.9, 0.9, 0.9)
  oldCard.x = 0
  oldCard.y = 100
  oldCard.setPluginData(DEPRECATED_KEY, 'true')
  oldCard.setPluginData(DEPRECATED_REASON_KEY, 'Replaced by Card v2 — migrate before Q3')
  created.push(oldCard)
  for (let i = 0; i < 2; i++) {
    const inst = oldCard.createInstance()
    page.appendChild(inst)
    inst.x = 240 * (i + 1)
    inst.y = 100
    created.push(inst)
  }

  // Left for YOU to delete by hand (select it on canvas, press Delete) —
  // a same-session scripted remove() doesn't fully commit the broken link,
  // so this has to be a real, separate deletion to test the "missing" case.
  const iconChip = figma.createComponent()
  iconChip.name = 'Icon Chip — delete me to test "missing"'
  page.appendChild(iconChip)
  iconChip.resize(48, 48)
  iconChip.fills = solid(1, 0.6, 0.4)
  iconChip.x = 0
  iconChip.y = 260
  created.push(iconChip)
  const orphan = iconChip.createInstance()
  page.appendChild(orphan)
  orphan.name = 'Orphaned chip instance'
  orphan.x = 100
  orphan.y = 260
  created.push(orphan)

  // Healthy component, left un-flagged so you can try marking it deprecated yourself
  const badge = figma.createComponent()
  badge.name = 'Status Badge'
  page.appendChild(badge)
  badge.resize(80, 24)
  badge.fills = solid(0.2, 0.7, 0.4)
  badge.x = 0
  badge.y = 340
  created.push(badge)
  const badgeInst = badge.createInstance()
  page.appendChild(badgeInst)
  badgeInst.x = 120
  badgeInst.y = 340
  created.push(badgeInst)

  figma.currentPage.selection = created
  figma.viewport.scrollAndZoomIntoView(created)
  figma.notify('Test data created — now select "Icon Chip" and press Delete, then Scan file')
}

figma.showUI(__html__, { width: 420, height: 560 })

if (figma.command === 'generate-test-data') {
  generateTestFixture()
}

// Live updates while the panel is open: a full rescan is debounced (so a
// burst of edits doesn't trigger dozens of rescans), while the check for
// "did someone just place an instance of something deprecated" runs
// immediately per created node, since it only looks at the new nodes in
// this one event rather than the whole file.
let rescanTimer: number | null = null
const RESCAN_DEBOUNCE_MS = 1200

function scheduleRescan() {
  if (rescanTimer !== null) clearTimeout(rescanTimer)
  rescanTimer = setTimeout(async () => {
    rescanTimer = null
    const rows = await scan()
    figma.ui.postMessage({ type: 'scan-result', rows, live: true })
  }, RESCAN_DEBOUNCE_MS) as unknown as number
}

const TRACKED_TYPES = new Set(['INSTANCE', 'COMPONENT', 'COMPONENT_SET'])

async function handleDocumentChanges(changes: DocumentChange[]) {
  for (const change of changes) {
    if (change.type === 'CREATE') {
      const node = await figma.getNodeByIdAsync(change.id)
      if (!node || !TRACKED_TYPES.has(node.type)) continue
      const page = findPage(node)
      const pageName = page ? page.name : 'Unknown page'
      nodeCache.set(node.id, { name: node.name, kind: node.type.toLowerCase(), pageName })
      appendHistory({ type: 'created', name: node.name, kind: node.type.toLowerCase(), pageName, detail: '' })

      if (node.type === 'INSTANCE') {
        let main: ComponentNode | null = null
        try {
          main = await (node as InstanceNode).getMainComponentAsync()
        } catch {
          main = null
        }
        if (main && main.removed) main = null
        if (!main) {
          figma.notify(`⚠️ Placed an instance of a missing component ("${node.name}")`)
          continue
        }
        const dep = isDeprecated(main)
        if (dep.deprecated) {
          figma.notify(`⚠️ "${displayName(main)}" is deprecated${dep.reason ? ` — ${dep.reason}` : ''}`)
        }
      }
      continue
    }

    if (change.type === 'DELETE') {
      const cached = nodeCache.get(change.id)
      if (cached) {
        appendHistory({ type: 'deleted', name: cached.name, kind: cached.kind, pageName: cached.pageName, detail: '' })
        nodeCache.delete(change.id)
      }
      continue
    }

    if (change.type === 'PROPERTY_CHANGE' && change.properties.includes('parent')) {
      const cached = nodeCache.get(change.id)
      const node = await figma.getNodeByIdAsync(change.id)
      if (!node || !cached) continue
      const page = findPage(node)
      const newPageName = page ? page.name : 'Unknown page'
      if (newPageName !== cached.pageName) {
        appendHistory({
          type: 'moved',
          name: cached.name,
          kind: cached.kind,
          pageName: newPageName,
          detail: `from "${cached.pageName}"`,
        })
        nodeCache.set(change.id, { ...cached, pageName: newPageName })
      }
    }
  }
}

figma.loadAllPagesAsync().then(() => {
  figma.on('documentchange', (event) => {
    handleDocumentChanges(event.documentChanges)
    scheduleRescan()
  })
})

figma.ui.onmessage = async (msg: any) => {
  if (msg.type === 'scan') {
    const rows = await scan()
    figma.ui.postMessage({ type: 'scan-result', rows })
  }

  if (msg.type === 'debug') {
    await figma.loadAllPagesAsync()
    const allNodes = figma.root.findAll(() => true)
    const instances = figma.root.findAllWithCriteria({ types: ['INSTANCE'] }) as InstanceNode[]
    const lines: string[] = []
    lines.push(`Total nodes in file: ${allNodes.length}`)
    lines.push(`Nodes of type INSTANCE: ${instances.length}`)
    const byType: Record<string, number> = {}
    for (const n of allNodes) byType[n.type] = (byType[n.type] || 0) + 1
    lines.push('Node type counts: ' + JSON.stringify(byType))
    lines.push('---')
    for (const instance of instances) {
      let main: ComponentNode | null = null
      let errMsg = ''
      try {
        main = await instance.getMainComponentAsync()
      } catch (e: any) {
        errMsg = String(e && e.message ? e.message : e)
      }
      lines.push(
        `"${instance.name}" (id ${instance.id}) → main=${main ? `"${main.name}" removed=${main.removed}` : 'null'}${errMsg ? ` ERROR:${errMsg}` : ''}`
      )
    }
    figma.ui.postMessage({ type: 'debug-result', text: lines.join('\n') })
  }

  if (msg.type === 'select') {
    const { pageId, nodeIds } = msg
    const pages = figma.root.findAllWithCriteria({ types: ['PAGE'] }) as PageNode[]
    const page = pages.find((p) => p.id === pageId)
    if (!page) return
    await figma.setCurrentPageAsync(page)
    const nodes = nodeIds
      .map((id: string) => figma.getNodeById(id))
      .filter((n: BaseNode | null): n is SceneNode => !!n && 'x' in n)
    if (nodes.length > 0) {
      figma.currentPage.selection = nodes
      figma.viewport.scrollAndZoomIntoView(nodes)
      figma.notify(`Selected ${nodes.length} instance${nodes.length === 1 ? '' : 's'}`)
    }
  }

  if (msg.type === 'get-selection-component') {
    const sel = figma.currentPage.selection
    if (sel.length !== 1 || (sel[0].type !== 'COMPONENT' && sel[0].type !== 'COMPONENT_SET')) {
      figma.ui.postMessage({ type: 'selection-component', node: null })
      return
    }
    const node = sel[0] as ComponentNode | ComponentSetNode
    figma.ui.postMessage({
      type: 'selection-component',
      node: {
        id: node.id,
        name: node.name,
        type: node.type,
        deprecated: node.getPluginData(DEPRECATED_KEY) === 'true',
        reason: node.getPluginData(DEPRECATED_REASON_KEY) || '',
      },
    })
  }

  if (msg.type === 'set-deprecated') {
    const { nodeId, deprecated, reason } = msg
    const node = figma.getNodeById(nodeId)
    if (!node || (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')) return
    const target = node as ComponentNode | ComponentSetNode
    target.setPluginData(DEPRECATED_KEY, deprecated ? 'true' : 'false')
    target.setPluginData(DEPRECATED_REASON_KEY, reason || '')
    const page = findPage(target)
    appendHistory({
      type: deprecated ? 'deprecated' : 'undeprecated',
      name: target.name,
      kind: target.type.toLowerCase(),
      pageName: page ? page.name : 'Unknown page',
      detail: reason || '',
    })
    figma.notify(deprecated ? `Marked "${target.name}" as deprecated` : `Cleared deprecation on "${target.name}"`)
    const rows = await scan()
    figma.ui.postMessage({ type: 'scan-result', rows })
  }

  if (msg.type === 'get-history') {
    figma.ui.postMessage({ type: 'history-result', entries: loadHistory() })
  }

  if (msg.type === 'clear-history') {
    figma.root.setPluginData(HISTORY_KEY, JSON.stringify([]))
    figma.ui.postMessage({ type: 'history-result', entries: [] })
    figma.notify('Change history cleared')
  }

  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height)
  }
}

figma.on('selectionchange', () => {
  const sel = figma.currentPage.selection
  if (sel.length === 1 && (sel[0].type === 'COMPONENT' || sel[0].type === 'COMPONENT_SET')) {
    const node = sel[0] as ComponentNode | ComponentSetNode
    figma.ui.postMessage({
      type: 'selection-component',
      node: {
        id: node.id,
        name: node.name,
        type: node.type,
        deprecated: node.getPluginData(DEPRECATED_KEY) === 'true',
        reason: node.getPluginData(DEPRECATED_REASON_KEY) || '',
      },
    })
  } else {
    figma.ui.postMessage({ type: 'selection-component', node: null })
  }
})
