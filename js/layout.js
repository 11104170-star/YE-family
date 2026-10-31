import { isConfirmedRelationship } from './relationships.js';

export const CARD_WIDTH = 156;
export const CARD_GAP = 18;

/** 配偶群決定位置；只有明確記錄雙親的子女，才從同一夫妻連接點接出。 */
export function buildGraph(data) {
  const people = new Map(data.people.map(p => [p.id, p]));
  const leaders = new Map(data.people.map(p => [p.id, p.id]));
  const find = id => leaders.get(id) === id ? id : find(leaders.get(id));
  for (const r of data.relationships) {
    if (r.type === 'spouse' && isConfirmedRelationship(r)) leaders.set(find(r.toId), find(r.fromId));
  }
  const units = new Map(), personUnit = new Map();
  for (const p of data.people) {
    const id = find(p.id);
    if (!units.has(id)) units.set(id, { id, people: [], children: [], parents: [] });
    units.get(id).people.push(p); personUnit.set(p.id, id);
  }
  const parentEdges = data.relationships.filter(r => r.type === 'parent-child' && isConfirmedRelationship(r));
  const spousePairs = new Set(data.relationships.filter(r => r.type === 'spouse' && isConfirmedRelationship(r)).map(r => [r.fromId, r.toId].sort().join(':')));
  for (const r of parentEdges) {
    const a = units.get(personUnit.get(r.fromId)), b = units.get(personUnit.get(r.toId));
    if (a.id === b.id) throw new Error('親子與配偶群衝突');
    if (!a.children.includes(b.id)) a.children.push(b.id);
    if (!b.parents.includes(a.id)) b.parents.push(a.id);
  }
  const minGeneration = Math.min(...data.people.map(p => p.generation).filter(Boolean));
  for (const u of units.values()) {
    u.generation = u.people.find(p => p.generation)?.generation || minGeneration;
    u.width = u.people.length * CARD_WIDTH + (u.people.length - 1) * CARD_GAP;
  }
  return { people, units, personUnit, parentEdges, spousePairs, minGeneration };
}

export function descendants(graph, id) {
  const seen = new Set(), queue = [...graph.units.get(id).children];
  while (queue.length) {
    const current = queue.pop();
    if (seen.has(current)) continue;
    seen.add(current); queue.push(...graph.units.get(current).children);
  }
  return seen;
}

export function layoutGraph(graph, { branch = 'all', collapsed = new Set(), photos = new Set() } = {}) {
  const allowed = new Set([...graph.units.values()].filter(u => branch === 'all' || u.people.some(p => p.branchId === branch)).map(u => u.id));
  const roots = [...allowed].filter(id => !graph.units.get(id).parents.some(p => allowed.has(p)));
  const visible = new Set();
  function reveal(id) {
    if (visible.has(id)) return;
    visible.add(id);
    if (!collapsed.has(id)) graph.units.get(id).children.filter(c => allowed.has(c)).forEach(reveal);
  }
  roots.forEach(reveal);
  const nodes = new Map([...visible].map(id => {
    const unit = graph.units.get(id);
    return [id, { ...unit, height: Math.max(...unit.people.map(p => photos.has(p.id) ? 168 : 80)), layoutChildren: [] }];
  }));
  // 共享子女僅放置一次，其他有證據的上代仍保留獨立連線。
  for (const node of nodes.values()) {
    const parent = node.parents.find(id => nodes.has(id) && !collapsed.has(id));
    if (parent) nodes.get(parent).layoutChildren.push(node.id);
  }
  const layoutRoots = [...nodes.values()].filter(n => !n.parents.some(id => nodes.has(id) && !collapsed.has(id)));
  function measure(id) {
    const n = nodes.get(id);
    n.subWidth = Math.max(n.width, n.layoutChildren.reduce((sum, c) => sum + measure(c), 0) + Math.max(0, n.layoutChildren.length - 1) * 34);
    return n.subWidth;
  }
  layoutRoots.forEach(n => measure(n.id));
  const generations = [...new Set([...nodes.values()].map(n => n.generation))].sort((a, b) => a - b);
  const rowY = new Map(); let cursorY = 64;
  for (const g of generations) {
    rowY.set(g, cursorY);
    cursorY += Math.max(...[...nodes.values()].filter(n => n.generation === g).map(n => n.height)) + 108;
  }
  function place(id, left) {
    const n = nodes.get(id);
    n.x = left + n.subWidth / 2; n.y = rowY.get(n.generation);
    const total = n.layoutChildren.reduce((sum, c) => sum + nodes.get(c).subWidth, 0) + Math.max(0, n.layoutChildren.length - 1) * 34;
    let childLeft = left + (n.subWidth - total) / 2;
    for (const child of n.layoutChildren) { place(child, childLeft); childLeft += nodes.get(child).subWidth + 34; }
  }
  let left = 88;
  for (const n of layoutRoots) { place(n.id, left); left += n.subWidth + 180; }
  const cards = new Map();
  for (const n of nodes.values()) n.people.forEach((p, i) => cards.set(p.id, {
    person: p, unitId: n.id, x: n.x - n.width / 2 + i * (CARD_WIDTH + CARD_GAP),
    y: n.y, width: CARD_WIDTH, height: photos.has(p.id) ? 168 : 80,
  }));
  const links = graph.parentEdges.filter(r => cards.has(r.fromId) && cards.has(r.toId) && !collapsed.has(graph.personUnit.get(r.fromId)));
  const families = new Map(), groupedEdges = new Set();
  const childEdges = new Map();
  for (const edge of links) {
    if (!childEdges.has(edge.toId)) childEdges.set(edge.toId, []);
    childEdges.get(edge.toId).push(edge);
  }
  for (const [childId, edges] of childEdges) {
    // 不能僅因上代有配偶就推定另一位家長；必須已有兩條獨立親子證據。
    if (edges.length !== 2) continue;
    const parentIds = edges.map(e => e.fromId).sort(), key = parentIds.join(':');
    if (!graph.spousePairs.has(key)) continue;
    const [left, right] = parentIds.map(id => cards.get(id)).sort((a, b) => a.x - b.x);
    if (left.unitId !== right.unitId || Math.abs(right.x - left.x - CARD_WIDTH - CARD_GAP) > .01) continue;
    if (!families.has(key)) {
      const unit = nodes.get(left.unitId);
      families.set(key, { id: key, parentIds, childIds: [],
        x: (left.x + left.width + right.x) / 2,
        y: left.y + Math.min(left.height, right.height) / 2,
        busY: unit.y + unit.height + 62 });
    }
    families.get(key).childIds.push(childId);
    edges.forEach(edge => groupedEdges.add(edge.id));
  }
  return { nodes, cards, links, families: [...families.values()], individualLinks: links.filter(r => !groupedEdges.has(r.id)), rowY, width: Math.max(left - 92, 360), height: Math.max(cursorY - 60, 280) };
}
