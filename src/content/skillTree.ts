import { START_NODE_ID } from '../game/types'
import type { Affix, ClusterId, NodeKind, SkillEdge, SkillNode, SkillTree, StatKey } from '../game/types'

const SMALL_STR: Affix[][] = [
  [{ stat: 'str', value: 4 }],
  [{ stat: 'hp', value: 10 }],
  [{ stat: 'attack', value: 3 }],
  [{ stat: 'defense', value: 3 }],
  [{ stat: 'block', value: 0.01 }],
  [{ stat: 'hpRegen', value: 0.4 }],
  [{ stat: 'hp', value: 6 }, { stat: 'str', value: 2 }],
]

const SMALL_DEX: Affix[][] = [
  [{ stat: 'dex', value: 4 }],
  [{ stat: 'critChance', value: 0.012 }],
  [{ stat: 'attack', value: 3 }],
  [{ stat: 'itemDrop', value: 0.012 }],
  [{ stat: 'goldMod', value: 0.03 }],
  [{ stat: 'lifeSteal', value: 0.01 }],
  [{ stat: 'dex', value: 2 }, { stat: 'critChance', value: 0.008 }],
]

const SMALL_INT: Affix[][] = [
  [{ stat: 'int', value: 4 }],
  [{ stat: 'xpMod', value: 0.04 }],
  [{ stat: 'materialDrop', value: 0.012 }],
  [{ stat: 'hp', value: 8 }],
  [{ stat: 'critMulti', value: 0.06 }],
  [{ stat: 'int', value: 2 }, { stat: 'xpMod', value: 0.02 }],
]

const NOTABLE: Record<ClusterId, { name: string; bonuses: Affix[] }[]> = {
  hub: [{ name: 'Waystone', bonuses: [{ stat: 'hp', value: 15 }] }],
  str: [
    { name: 'Iron Discipline', bonuses: [{ stat: 'str', value: 12 }, { stat: 'defense', value: 8 }] },
    { name: 'Blooded Edge', bonuses: [{ stat: 'attack', value: 10 }, { stat: 'hp', value: 20 }] },
    { name: 'Tower Stance', bonuses: [{ stat: 'block', value: 0.04 }, { stat: 'defense', value: 10 }] },
    { name: 'Relic Muscle', bonuses: [{ stat: 'str', value: 8 }, { stat: 'goldMod', value: 0.08 }] },
  ],
  dex: [
    { name: 'Silent Draw', bonuses: [{ stat: 'dex', value: 12 }, { stat: 'critChance', value: 0.04 }] },
    { name: 'Gilded Fingers', bonuses: [{ stat: 'itemDrop', value: 0.05 }, { stat: 'goldMod', value: 0.1 }] },
    { name: 'Twin Fang', bonuses: [{ stat: 'attack', value: 8 }, { stat: 'critMulti', value: 0.15 }] },
    { name: 'Windstep', bonuses: [{ stat: 'dex', value: 8 }, { stat: 'block', value: 0.02 }] },
  ],
  int: [
    { name: 'Codex Burn', bonuses: [{ stat: 'int', value: 12 }, { stat: 'xpMod', value: 0.12 }] },
    { name: 'Ash Diviner', bonuses: [{ stat: 'materialDrop', value: 0.06 }, { stat: 'int', value: 8 }] },
    { name: 'Runic Veil', bonuses: [{ stat: 'hp', value: 25 }, { stat: 'critMulti', value: 0.12 }] },
    { name: "Scholar's Greed", bonuses: [{ stat: 'goldMod', value: 0.08 }, { stat: 'xpMod', value: 0.08 }] },
  ],
}

const KEYSTONES: Record<Exclude<ClusterId, 'hub'>, { name: string; bonuses: Affix[] }> = {
  str: {
    name: 'Juggernaut Heart',
    bonuses: [
      { stat: 'hp', value: 80 },
      { stat: 'defense', value: 25 },
      { stat: 'str', value: 20 },
      { stat: 'critChance', value: -0.08 },
    ],
  },
  dex: {
    name: 'Deadeye Contract',
    bonuses: [
      { stat: 'critChance', value: 0.12 },
      { stat: 'itemDrop', value: 0.1 },
      { stat: 'dex', value: 18 },
      { stat: 'hp', value: -40 },
    ],
  },
  int: {
    name: 'Archivist Crown',
    bonuses: [
      { stat: 'xpMod', value: 0.25 },
      { stat: 'materialDrop', value: 0.12 },
      { stat: 'int', value: 18 },
      { stat: 'defense', value: -12 },
    ],
  },
}

const smallNames: Record<Exclude<ClusterId, 'hub'>, string[]> = {
  str: ['Brawn', 'Plate', 'Might', 'Guard', 'Bulk', 'Force', 'Grit', 'Impact'],
  dex: ['Swift', 'Aim', 'Flicker', 'Poise', 'Hunt', 'Edge', 'Slip', 'Mark'],
  int: ['Study', 'Spark', 'Lore', 'Ward', 'Focus', 'Sigil', 'Dream', 'Vault'],
}

function hexes(radius: number): { q: number; r: number }[] {
  const out: { q: number; r: number }[] = []
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius)
    const r2 = Math.min(radius, -q + radius)
    for (let r = r1; r <= r2; r++) out.push({ q, r })
  }
  return out
}

function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  return {
    x: size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
    y: size * (1.5 * r),
  }
}

function hexDist(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const aq = a.q
  const ar = a.r
  const as = -aq - ar
  const bq = b.q
  const br = b.r
  const bs = -bq - br
  return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs(as - bs))
}

function buildTree(): SkillTree {
  const nodes: SkillNode[] = []
  const edges: SkillEdge[] = []
  let nextId = 0

  const start: SkillNode = {
    id: nextId++,
    x: 0,
    y: 0,
    kind: 'keystone',
    cluster: 'hub',
    name: 'Relic Heart',
    bonuses: [{ stat: 'hp', value: 12 }, { stat: 'attack', value: 2 }],
  }
  nodes.push(start)

  const hubRing = 6
  const hubIds: number[] = []
  for (let i = 0; i < hubRing; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2
    const id = nextId++
    hubIds.push(id)
    const stats: StatKey[] = ['hp', 'attack', 'defense', 'str', 'dex', 'int']
    nodes.push({
      id,
      x: Math.cos(angle) * 88,
      y: Math.sin(angle) * 88,
      kind: 'small',
      cluster: 'hub',
      name: 'Awakening',
      bonuses: [{ stat: stats[i], value: stats[i] === 'hp' ? 8 : 3 }],
    })
    edges.push({ a: 0, b: id })
  }

  const clusters: { cluster: Exclude<ClusterId, 'hub'>; angle: number }[] = [
    { cluster: 'str', angle: -Math.PI / 2 },
    { cluster: 'dex', angle: Math.PI / 6 },
    { cluster: 'int', angle: (5 * Math.PI) / 6 },
  ]

  const gateways: number[] = []
  for (let i = 0; i < clusters.length; i++) {
    const { cluster, angle } = clusters[i]
    const id = nextId++
    gateways.push(id)
    nodes.push({
      id,
      x: Math.cos(angle) * 170,
      y: Math.sin(angle) * 170,
      kind: 'notable',
      cluster,
      name: cluster === 'str' ? 'Path of Might' : cluster === 'dex' ? 'Path of Cunning' : 'Path of Lore',
      bonuses: [{ stat: cluster, value: 6 }, { stat: 'hp', value: 10 }],
    })
    const nearestHub = hubIds[i * 2] ?? hubIds[0]
    edges.push({ a: nearestHub, b: id })
  }

  const neighbors = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ] as const

  for (let c = 0; c < clusters.length; c++) {
    const { cluster, angle } = clusters[c]
    const originX = Math.cos(angle) * 520
    const originY = Math.sin(angle) * 520
    const cells = hexes(4)
    const idByKey = new Map<string, number>()
    const notableBag = [...NOTABLE[cluster]]
    let notableIndex = 0
    const names = smallNames[cluster]

    for (const cell of cells) {
      const dist = hexDist(cell, { q: 0, r: 0 })
      const pix = hexToPixel(cell.q, cell.r, 46)
      const id = nextId++
      idByKey.set(`${cell.q},${cell.r}`, id)
      let kind: NodeKind = 'small'
      let name = names[(Math.abs(cell.q * 3 + cell.r * 7) + c) % names.length]
      let bonuses: Affix[]
      if (dist === 0) {
        kind = 'keystone'
        name = KEYSTONES[cluster].name
        bonuses = KEYSTONES[cluster].bonuses
      } else if (dist === 2 && (cell.q + cell.r + c) % 2 === 0) {
        kind = 'notable'
        const notable = notableBag[notableIndex % notableBag.length]
        notableIndex += 1
        name = notable.name
        bonuses = notable.bonuses
      } else {
        const bag = cluster === 'str' ? SMALL_STR : cluster === 'dex' ? SMALL_DEX : SMALL_INT
        bonuses = bag[Math.abs(cell.q + cell.r * 4 + c) % bag.length]
      }
      nodes.push({
        id,
        x: originX + pix.x,
        y: originY + pix.y,
        kind,
        cluster,
        name,
        bonuses,
      })
    }

    for (const cell of cells) {
      const from = idByKey.get(`${cell.q},${cell.r}`)
      if (from === undefined) continue
      for (const [dq, dr] of neighbors) {
        const to = idByKey.get(`${cell.q + dq},${cell.r + dr}`)
        if (to === undefined || to <= from) continue
        edges.push({ a: from, b: to })
      }
    }

    const centerId = idByKey.get('0,0')
    const rim = cells
      .map((cell) => {
        const pix = hexToPixel(cell.q, cell.r, 46)
        const x = originX + pix.x
        const y = originY + pix.y
        const gx = nodes.find((n) => n.id === gateways[c])!
        const d = (x - gx.x) ** 2 + (y - gx.y) ** 2
        return { id: idByKey.get(`${cell.q},${cell.r}`)!, d }
      })
      .sort((a, b) => a.d - b.d)[0]
    if (rim) edges.push({ a: gateways[c], b: rim.id })
    void centerId
  }

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const adj = new Map<number, number[]>()
  for (const node of nodes) adj.set(node.id, [])
  for (const edge of edges) {
    adj.get(edge.a)!.push(edge.b)
    adj.get(edge.b)!.push(edge.a)
  }

  return { nodes, edges, byId, adj }
}

export const skillTree = buildTree()

export function isAdjacentAllocated(nodeId: number, allocated: ReadonlySet<number>): boolean {
  const neighbors = skillTree.adj.get(nodeId) ?? []
  return neighbors.some((id) => allocated.has(id))
}

export function canAllocateNode(
  nodeId: number,
  allocated: number[],
  unspent: number,
  pending: number[] = [],
): { ok: true } | { ok: false; reason: string } {
  const taken = [...allocated, ...pending]
  if (taken.includes(nodeId)) return { ok: false, reason: 'Already allocated.' }
  if (unspent < pending.length + 1) return { ok: false, reason: 'No skill points.' }
  if (!isAdjacentAllocated(nodeId, new Set(taken))) {
    return { ok: false, reason: 'Must connect to an allocated node.' }
  }
  return { ok: true }
}

export function prunePending(allocated: number[], pending: number[], removeId: number): number[] {
  let next = pending.filter((id) => id !== removeId)
  const confirmed = new Set(allocated)
  let changed = true
  while (changed) {
    changed = false
    const keep = new Set([...confirmed, ...next])
    const filtered = next.filter((id) => isAdjacentAllocated(id, keep))
    if (filtered.length !== next.length) {
      next = filtered
      changed = true
    }
  }
  return next
}

export function allocationRemainsConnected(allocated: number[], removed: number[]): boolean {
  const remaining = new Set(allocated.filter((id) => !removed.includes(id)))
  if (!remaining.has(START_NODE_ID)) return false

  const reached = new Set<number>([START_NODE_ID])
  const stack = [START_NODE_ID]
  while (stack.length > 0) {
    const current = stack.pop()!
    for (const neighbor of skillTree.adj.get(current) ?? []) {
      if (!remaining.has(neighbor) || reached.has(neighbor)) continue
      reached.add(neighbor)
      stack.push(neighbor)
    }
  }
  return reached.size === remaining.size
}
