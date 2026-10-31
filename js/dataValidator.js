import { isConfirmedRelationship } from './relationships.js';
const statuses = new Set(['source-supported', 'user-confirmed', 'pending']);

/** 所有可視親屬邊都必須有證據；推測資料不得成為結構上的父母。 */
export function validateData(data) {
  const errors = [], warnings = [];
  if (!data || !Array.isArray(data.people) || !Array.isArray(data.relationships) || !Array.isArray(data.branches)) return { valid: false, errors: ['人物、關係與支系列表必須為陣列'], warnings };
  const people = data.people || [], relations = data.relationships || [];
  const byId = new Map(), relationIds = new Set();
  const confirmations = new Map((data.confirmations || []).map(c => [c.id, c]));
  const fail = message => errors.push(message);
  if (confirmations.size !== (data.confirmations || []).length) fail('重複家族確認來源 ID');
  for (const p of people) {
    if (!p.id || byId.has(p.id)) fail(`重複或空白人物 ID：${p.id}`);
    byId.set(p.id, p);
    if (!p.name) fail(`${p.id} 缺少姓名`);
    if (p.generation !== null && (!Number.isInteger(p.generation) || p.generation < 1)) fail(`${p.id} 世代格式錯誤`);
    if (!Array.isArray(p.parentIds) || !Array.isArray(p.spouseIds) || !Array.isArray(p.aliases)) fail(`${p.id} 陣列欄位格式錯誤`);
    if (p.photo && !/^assets\/photos\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/i.test(p.photo)) fail(`${p.id} 照片路徑格式錯誤`);
    if (p.birthDate && !p.deathDate && !/^(?:約)?\d{4}(?:年)?$/.test(p.birthDate)) fail(`${p.id} 可能在世人物出生資料僅可填年份`);
  }
  if (people.some(p => !Array.isArray(p.parentIds) || !Array.isArray(p.spouseIds) || !Array.isArray(p.aliases))) return { valid: false, errors, warnings };
  const parents = new Map(people.map(p => [p.id, []]));
  const edgeKeys = new Set();
  for (const r of relations) {
    if (!r.id || relationIds.has(r.id)) fail(`重複或空白關係 ID：${r.id}`);
    relationIds.add(r.id);
    for (const id of r.confirmationIds || []) if (!confirmations.has(id)) fail(`${r.id} 家族確認來源不存在`);
    const a = byId.get(r.fromId), b = byId.get(r.toId);
    if (!a || !b) { fail(`${r.id} 引用不存在人物`); continue; }
    if (a.id === b.id) fail(`${r.id} 自身親屬關係`);
    if (!statuses.has(r.status)) fail(`${r.id} 缺少有效證據狀態`);
    if (r.status === 'user-confirmed') {
      if (r.source?.type !== 'family-confirmation' || !r.source.evidence || !/^\d{4}-\d{2}-\d{2}$/.test(r.source.date || '') || !confirmations.has(r.source.confirmationId)) fail(`${r.id} 缺少家族確認來源`);
    } else if (!r.source?.pages?.length || !r.source.evidence) fail(`${r.id} 缺少來源證據`);
    if (!['parent-child', 'spouse', 'possible-ancestor'].includes(r.type)) fail(`${r.id} 未知關係類型`);
    const key = r.type === 'spouse' ? ['spouse', ...[a.id, b.id].sort()].join(':') : `${r.type}:${a.id}:${b.id}`;
    if (edgeKeys.has(key)) fail(`${r.id} 重複親屬連線`);
    edgeKeys.add(key);
    if (r.type === 'parent-child') {
      if (!isConfirmedRelationship(r)) fail(`${r.id} 待確認關係不可作為確定親子邊`);
      if (a.recordType === 'ancestor-note' || b.recordType === 'ancestor-note') fail(`${r.id} 推測記載不可當作具名親子`);
      parents.get(b.id).push(a.id);
      if (!b.parentIds?.includes(a.id)) fail(`${r.id} 與 parentIds 不一致`);
      if (a.generation && b.generation && b.generation !== a.generation + 1) fail(`${r.id} 親子世代不相鄰`);
      if (a.spouseIds?.includes(b.id) || b.spouseIds?.includes(a.id)) fail(`${r.id} 同時為配偶與親子`);
      if (a.branchId !== b.branchId) warnings.push(`${r.id} 跨支系親子，請人工覆核證據`);
      if (r.role === 'father' && b.fatherId !== a.id) fail(`${r.id} 父親角色與 fatherId 不一致`);
      if (r.role === 'mother' && b.motherId !== a.id) fail(`${r.id} 母親角色與 motherId 不一致`);
    }
    if (r.type === 'spouse') {
      if (!isConfirmedRelationship(r)) fail(`${r.id} 待確認婚姻不可列為配偶`);
      if (!a.spouseIds?.includes(b.id) || !b.spouseIds?.includes(a.id)) fail(`${r.id} 配偶引用不對稱`);
      if (a.generation && b.generation && a.generation !== b.generation) fail(`${r.id} 配偶世代不同，需人工核對後調整模型`);
    }
    if (r.type === 'possible-ancestor' && r.status !== 'pending') fail(`${r.id} 推測祖先必須標為待考證`);
  }
  for (const p of people) {
    for (const id of p.confirmationIds || []) if (!confirmations.has(id)) fail(`${p.id} 家族確認來源不存在`);
    if (p.source?.type === 'family-confirmation' && !confirmations.has(p.source.confirmationId)) fail(`${p.id} 人物家族確認來源不存在`);
    const refs = [...(p.parentIds || []), ...(p.spouseIds || []), p.fatherId, p.motherId].filter(Boolean);
    for (const ref of refs) if (!byId.has(ref)) fail(`${p.id} 引用不存在人物：${ref}`);
    if (new Set(p.parentIds).size !== p.parentIds?.length) fail(`${p.id} 重複上代引用`);
    if ((p.parentIds?.length || 0) > 2) fail(`${p.id} 超過兩位上代，請區分生親／其他親屬模型`);
    if (p.fatherId && p.fatherId === p.motherId) fail(`${p.id} 父母為同一人`);
    for (const id of [p.fatherId, p.motherId].filter(Boolean)) if (!p.parentIds?.includes(id)) fail(`${p.id} 父母欄位與 parentIds 不一致`);
    for (const id of p.parentIds || []) if (!parents.get(p.id)?.includes(id)) fail(`${p.id} 上代缺少親子證據`);
    for (const id of p.spouseIds || []) {
      if (!byId.get(id)?.spouseIds?.includes(p.id)) fail(`${p.id} 配偶引用不對稱`);
      if (!edgeKeys.has(['spouse', ...[p.id, id].sort()].join(':'))) fail(`${p.id} 配偶缺少關係證據`);
    }
  }
  const visited = new Set(), active = new Set();
  function visit(id) {
    if (active.has(id)) { fail(`循環祖先關係：${id}`); return; }
    if (visited.has(id)) return;
    active.add(id);
    for (const parent of parents.get(id) || []) visit(parent);
    active.delete(id); visited.add(id);
  }
  people.forEach(p => visit(p.id));
  // 任何祖先都不可同時是配偶。
  for (const p of people) {
    const ancestors = new Set(), queue = [...(parents.get(p.id) || [])];
    while (queue.length) {
      const id = queue.pop();
      if (ancestors.has(id)) continue;
      ancestors.add(id); queue.push(...(parents.get(id) || []));
    }
    if (p.spouseIds?.some(id => ancestors.has(id))) fail(`${p.id} 配偶同時為祖先`);
  }
  const branchIds = new Set();
  for (const branch of data.branches || []) {
    if (branchIds.has(branch.id)) fail(`重複支系 ID：${branch.id}`);
    branchIds.add(branch.id);
    for (const root of branch.rootIds || []) {
      if (!byId.has(root)) fail(`${branch.id} 支系根人物不存在`);
      else if (byId.get(root).branchId !== branch.id || byId.get(root).parentIds.length) fail(`${branch.id} 支系根資料錯誤`);
    }
  }
  for (const p of people) if (!branchIds.has(p.branchId)) fail(`${p.id} 支系不存在`);
  for (const q of data.reviewItems || []) for (const id of q.personIds || []) if (!byId.has(id)) fail(`${q.id} 待確認項目引用不存在人物`);
  return { valid: errors.length === 0, errors, warnings };
}
