import { canAllocateNode } from '../content/skillTree'
import type { PlayerState } from './types'

export function allocateNode(player: PlayerState, nodeId: number): PlayerState {
  const check = canAllocateNode(nodeId, player.allocatedNodeIds, player.skillPointsUnspent)
  if (!check.ok) return player
  return {
    ...player,
    skillPointsUnspent: player.skillPointsUnspent - 1,
    allocatedNodeIds: [...player.allocatedNodeIds, nodeId],
  }
}
