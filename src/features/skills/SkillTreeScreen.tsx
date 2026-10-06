import { canAllocateNode, skillTree } from '../../content/skillTree'
import { formatAffix } from '../../game/format'
import { useGameStore } from '../../state/gameStore'
import { TransformComponent, TransformWrapper, useTransformComponent } from 'react-zoom-pan-pinch'
import { useEffect, useMemo, useState } from 'react'
import type { NodeKind } from '../../game/types'

const clusterStroke: Record<string, string> = {
  hub: '#f59e0b',
  str: '#ef4444',
  dex: '#22c55e',
  int: '#38bdf8',
}

const clusterPlate: Record<string, string> = {
  hub: '#78350f',
  str: '#7f1d1d',
  dex: '#14532d',
  int: '#0c4a6e',
}


function SpaceBackdrop({ contentWidth, contentHeight }: { contentWidth: number; contentHeight: number }) {
  const { state, instance } = useTransformComponent((ctx) => ctx)
  const [frame, setFrame] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = instance.wrapperComponent
    if (!el) return
    const measure = () => setFrame({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    return () => obs.disconnect()
  }, [instance])
  const scale = state.scale || 1
  const imgW = Math.max(contentWidth, frame.w / scale)
  const imgH = Math.max(contentHeight, frame.h / scale)
  const left = state.positionX + ((contentWidth - imgW) * scale) / 2
  const top = state.positionY + ((contentHeight - imgH) * scale) / 2
  return (
    <div
      className="pointer-events-none absolute bg-cover bg-center"
      style={{
        left,
        top,
        width: imgW * scale,
        height: imgH * scale,
        backgroundImage: "url(/skill-path-bg.png?v=3)",
      }}
    />
  )
}

function kindSize(kind: NodeKind) {
  if (kind === 'keystone') return 22
  if (kind === 'notable') return 14
  return 8
}

function plateSize(kind: NodeKind) {
  return kindSize(kind) + (kind === 'keystone' ? 12 : kind === 'notable' ? 9 : 6)
}

function diamond(cx: number, cy: number, r: number) {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
}

function hex(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 6 + i * (Math.PI / 3)
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
}

function NodeGlyph({
  cx,
  cy,
  kind,
  fill,
  stroke,
  strokeWidth,
  dashed,
}: {
  cx: number
  cy: number
  kind: NodeKind
  fill: string
  stroke: string
  strokeWidth: number
  dashed?: boolean
}) {
  const r = kindSize(kind)
  const dash = dashed ? '4 3' : undefined
  if (kind === 'notable') {
    return (
      <polygon
        points={diamond(cx, cy, r)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
      />
    )
  }
  if (kind === 'keystone') {
    return (
      <polygon
        points={hex(cx, cy, r)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
      />
    )
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={dash}
    />
  )
}

function Plate({
  cx,
  cy,
  kind,
  fill,
}: {
  cx: number
  cy: number
  kind: NodeKind
  fill: string
}) {
  const r = plateSize(kind)
  if (kind === 'notable') {
    return <polygon points={diamond(cx, cy, r)} fill={fill} opacity={0.9} />
  }
  if (kind === 'keystone') {
    return <polygon points={hex(cx, cy, r)} fill={fill} opacity={0.9} />
  }
  return <circle cx={cx} cy={cy} r={r} fill={fill} opacity={0.9} />
}

export function SkillTreeScreen() {
  const player = useGameStore((s) => s.player)!
  const pendingNodeIds = useGameStore((s) => s.pendingNodeIds)
  const pendingRemovalNodeIds = useGameStore((s) => s.pendingRemovalNodeIds)
  const queueNode = useGameStore((s) => s.queueNode)
  const confirmNodes = useGameStore((s) => s.confirmNodes)
  const discardNodes = useGameStore((s) => s.discardNodes)
  const error = useGameStore((s) => s.error)
  const [hoverId, setHoverId] = useState<number | null>(null)
  const [assignMode, setAssignMode] = useState(false)
  const allocated = useMemo(() => new Set(player.allocatedNodeIds), [player.allocatedNodeIds])
  const pending = useMemo(() => new Set(pendingNodeIds), [pendingNodeIds])
  const pendingRemoval = useMemo(() => new Set(pendingRemovalNodeIds), [pendingRemovalNodeIds])
  const hover = hoverId !== null ? skillTree.byId.get(hoverId) : undefined
  const remaining = player.skillPointsUnspent - pendingNodeIds.length + pendingRemovalNodeIds.length
  const pendingCount = pendingNodeIds.length + pendingRemovalNodeIds.length
  const refundCost = pendingRemovalNodeIds.length * player.level * 2
  const effectiveAllocated = player.allocatedNodeIds.length + pendingNodeIds.length - pendingRemovalNodeIds.length

  const xs = skillTree.nodes.map((n) => n.x)
  const ys = skillTree.nodes.map((n) => n.y)
  const minX = Math.min(...xs) - 80
  const minY = Math.min(...ys) - 80
  const width = Math.max(...xs) - minX + 80
  const height = Math.max(...ys) - minY + 80

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-xl text-amber-100">Skill Path</h2>
          <p className="text-sm text-stone-400">
            {effectiveAllocated} allocated · {remaining} unspent
            {pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
            {pendingRemovalNodeIds.length > 0 ? ` · ${refundCost.toLocaleString()} gold` : ''}
          </p>
          {assignMode && <p className="text-xs text-amber-200/90">Tap a node to assign or refund.</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
        <button
          type="button"
          aria-pressed={assignMode}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${
            assignMode ? 'bg-amber-500 font-medium text-stone-950' : 'border border-stone-600 text-stone-100'
          }`}
          onClick={() => setAssignMode((on) => !on)}
        >
          {assignMode ? 'Done' : 'Assign'}
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-stone-800 bg-[#070504] [overscroll-behavior:none] [touch-action:none]">
        <TransformWrapper
          minScale={0.16}
          maxScale={1.35}
          fitOnInit="contain"
          limitToBounds
          centerZoomedOut
          smooth
          disablePadding
          doubleClick={{ disabled: true }}
          wheel={{ step: 0.00032 }}
          pinch={{ step: 4 }}
          panning={{ velocityDisabled: true, excluded: assignMode ? ['skill-node'] : [] }}
        >
          <SpaceBackdrop contentWidth={width} contentHeight={height} />
          <TransformComponent wrapperClass="!h-full !w-full" contentClass="!w-max !h-max">
            <svg width={width} height={height} className="cursor-grab">
              {skillTree.edges.map((edge) => {
                const a = skillTree.byId.get(edge.a)!
                const b = skillTree.byId.get(edge.b)!
                const aOn = (allocated.has(edge.a) && !pendingRemoval.has(edge.a)) || pending.has(edge.a)
                const bOn = (allocated.has(edge.b) && !pendingRemoval.has(edge.b)) || pending.has(edge.b)
                const lit = aOn && bOn
                const refundEdge = pendingRemoval.has(edge.a) || pendingRemoval.has(edge.b)
                const pendingEdge = lit && (pending.has(edge.a) || pending.has(edge.b))
                return (
                  <line
                    key={`${edge.a}-${edge.b}`}
                    x1={a.x - minX}
                    y1={a.y - minY}
                    x2={b.x - minX}
                    y2={b.y - minY}
                    stroke={refundEdge ? '#f87171' : pendingEdge ? '#fde68a' : lit ? '#fbbf24' : '#292524'}
                    strokeWidth={lit || refundEdge ? 2 : 1}
                    strokeDasharray={pendingEdge || refundEdge ? '5 4' : undefined}
                  />
                )
              })}
              {skillTree.nodes.map((node) => {
                const on = allocated.has(node.id)
                const queued = pending.has(node.id)
                const removing = pendingRemoval.has(node.id)
                const available = canAllocateNode(
                  node.id,
                  player.allocatedNodeIds,
                  player.skillPointsUnspent,
                  pendingNodeIds,
                ).ok
                const cx = node.x - minX
                const cy = node.y - minY
                const fill = removing ? '#7f1d1d' : on ? '#fde68a' : queued ? clusterStroke[node.cluster] : 'transparent'
                const stroke = removing ? '#f87171' : on ? '#facc15' : clusterStroke[node.cluster]
                const showPlate = on || queued || node.kind !== 'small'
                return (
                  <g
                    key={node.id}
                    className={`skill-node ${assignMode ? 'cursor-pointer' : ''}`}
                    onMouseEnter={() => setHoverId(node.id)}
                    onClick={() => {
                      setHoverId(node.id)
                      if (assignMode) queueNode(node.id)
                    }}
                  >
                    {showPlate && (
                      <Plate
                        cx={cx}
                        cy={cy}
                        kind={node.kind}
                        fill={removing ? '#450a0a' : on ? '#854d0e' : clusterPlate[node.cluster]}
                      />
                    )}
                    <NodeGlyph
                      cx={cx}
                      cy={cy}
                      kind={node.kind}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={on || queued || available ? 2.6 : 1.3}
                      dashed={queued || removing}
                    />
                  </g>
                )
              })}
            </svg>
          </TransformComponent>
        </TransformWrapper>
        {hover && (
          <div className="pointer-events-none absolute right-2 top-2 max-w-[11rem] rounded-xl border border-stone-700 bg-stone-950/95 p-2 text-sm">
            <p className="font-medium text-amber-100">{hover.name}</p>
            <p className="text-[11px] uppercase text-stone-500">
              {hover.kind} · {hover.cluster}
              {pendingRemoval.has(hover.id)
                ? ' · pending removal'
                : allocated.has(hover.id)
                  ? ' · allocated'
                  : pending.has(hover.id)
                    ? ' · pending'
                    : ''}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-stone-300">
              {hover.bonuses.map((b, i) => (
                <li key={i}>{formatAffix(b)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {pendingCount > 0 && (
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-lg border border-stone-700 py-2 text-sm text-stone-300"
            onClick={discardNodes}
          >
            Discard
          </button>
          <button
            type="button"
            className={`rounded-lg py-2 text-sm font-medium text-amber-50 ${
              pendingRemovalNodeIds.length > 0 ? 'bg-red-800' : 'bg-amber-700'
            }`}
            onClick={() => {
              confirmNodes()
              if (!useGameStore.getState().error) setAssignMode(false)
            }}
          >
            {pendingRemovalNodeIds.length > 0
              ? `Unassign ${pendingRemovalNodeIds.length} · ${refundCost.toLocaleString()} gold`
              : `Confirm ${pendingNodeIds.length}`}
          </button>
        </div>
      )}
    </div>
  )
}
