/**
 * Node Registry — central store of all NodeDefinition entries.
 * Platform nodes are registered here; application-layer nodes
 * (miliastra package) are registered in miliastra/index.ts and
 * call registerNodes() at startup.
 */
import type { NodeDefinition } from '../types'

const _registry = new Map<string, NodeDefinition>()

export function registerNode(def: NodeDefinition) {
  if (_registry.has(def.type)) {
    console.warn(`[NodeRegistry] Overwriting node type: ${def.type}`)
  }
  _registry.set(def.type, def)
}

export function registerNodes(defs: NodeDefinition[]) {
  defs.forEach(registerNode)
}

export function getNodeDef(type: string): NodeDefinition | undefined {
  return _registry.get(type)
}

export function getAllNodeDefs(): NodeDefinition[] {
  return Array.from(_registry.values())
}

export function getNodeDefsByCategory(cat: NodeDefinition['category']): NodeDefinition[] {
  return Array.from(_registry.values()).filter(d => d.category === cat)
}
