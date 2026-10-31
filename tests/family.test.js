import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateData } from '../js/dataValidator.js';
import { buildGraph, layoutGraph, descendants } from '../js/layout.js';
import { searchPeople } from '../js/search.js';
const data = JSON.parse(await readFile(new URL('../data/family.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(data);
const graph = buildGraph(data);

test('兩頁登錄完整，統計不把推測父輩視為具名人物', () => {
  assert.equal(data.people.length, 75);
  assert.equal(data.people.filter(p => p.recordType === 'person').length, 74);
  assert.deepEqual(validateData(data), {valid:true, errors:[], warnings:[]});
  assert.equal(data.relationships.filter(r => r.type === 'parent-child').length, 70);
  assert.equal(data.relationships.filter(r => r.type === 'spouse').length, 2);
});
test('跨頁、跨行與並列人物依原始層級建連線', () => {
  const parents = id => data.people.find(p => p.id === id).parentIds;
  assert.deepEqual(parents('P0063'), ['P0061']); // 家華屬進來，而非怡寧
  assert.deepEqual(parents('P0066'), ['P0061']);
  assert.deepEqual(parents('P0032'), ['P0027']);
  assert.equal(data.people.find(p => p.id === 'P0032').name, '葉梓福');
  assert.deepEqual(parents('P0012'), ['P0010']); // 文章與有財並列，非其子
  assert.deepEqual(parents('P0060'), ['P0056']);
  assert.equal(data.people.find(p => p.id === 'P0060').gender, 'female');
});
test('兩支系無血緣邊，推測父輩不變成父親，未見續記不增設人物', () => {
  for (const r of data.relationships.filter(r => r.type === 'parent-child')) assert.equal(graph.people.get(r.fromId).branchId, graph.people.get(r.toId).branchId);
  assert.deepEqual(graph.people.get('P0046').parentIds, []);
  assert.equal(data.relationships.find(r => r.id === 'U01').status, 'pending');
  assert.ok(!data.relationships.some(r => r.type === 'parent-child' && r.fromId === 'P0069'));
});
test('驗證器拒絕重複 ID、懸空引用、世代錯誤與循環', () => {
  let changed = clone(); changed.people[1].id = changed.people[0].id;
  assert.ok(!validateData(changed).valid);
  changed = clone(); changed.people[3].parentIds.push('missing');
  assert.ok(validateData(changed).errors.some(e => e.includes('不存在人物')));
  changed = clone(); changed.people[3].generation = 17;
  assert.ok(validateData(changed).errors.some(e => e.includes('世代')));
  changed = clone(); changed.people[0].parentIds = ['P0003'];
  changed.relationships.push({id:'cycle', type:'parent-child', fromId:'P0003', toId:'P0001', status:'source-supported', source:{pages:[1], evidence:'測試'}});
  assert.ok(validateData(changed).errors.some(e => e.includes('循環')));
});
test('驗證器拒絕無證據、配偶不對稱、推測親子與敏感出生日期', () => {
  let changed = clone(); changed.relationships[0].source = null;
  assert.ok(!validateData(changed).valid);
  changed = clone(); changed.people[1].spouseIds = [];
  assert.ok(!validateData(changed).valid);
  changed = clone(); changed.relationships[0].status = 'pending';
  assert.ok(!validateData(changed).valid);
  changed = clone(); changed.people[10].birthDate = '2000-02-03';
  assert.ok(!validateData(changed).valid);
});

function noOverlap(layout) {
  const cards = [...layout.cards.values()];
  for (let i=0; i<cards.length; i++) for (let j=i+1; j<cards.length; j++) {
    const a=cards[i], b=cards[j];
    assert.ok(!(a.x < b.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y), `${a.person.id} 與 ${b.person.id} 重疊`);
  }
}
test('所有人物僅出現一次、世代對齊、配偶並排且卡片不重疊', () => {
  const layout = layoutGraph(graph);
  assert.equal(layout.cards.size, data.people.length);
  noOverlap(layout);
  for (const r of data.relationships.filter(r => r.type === 'spouse')) assert.equal(layout.cards.get(r.fromId).y, layout.cards.get(r.toId).y);
  for (const r of layout.links) assert.ok(layout.cards.get(r.fromId).y < layout.cards.get(r.toId).y);
  for (const p of data.people.filter(p => p.generation)) assert.equal(layout.cards.get(p.id).y, layout.rowY.get(p.generation));
});
test('高低不同照片卡不重疊，連線仍指向真實人物', () => {
  const layout = layoutGraph(graph, { photos: new Set(['P0001','P0014','P0051','P0072']) });
  noOverlap(layout);
  assert.equal(layout.cards.get('P0014').height, 168);
  assert.equal(layout.cards.get('P0010').height, 80);
  for (const r of layout.links) assert.ok(layout.cards.get(r.fromId).y + layout.cards.get(r.fromId).height < layout.cards.get(r.toId).y);
});
test('收合不改動原始關係，展開可恢復全部人物', () => {
  const original = JSON.stringify(data);
  const layout = layoutGraph(graph, { collapsed: new Set(['P0007']) });
  assert.ok(!layout.cards.has('P0009')); assert.ok(layout.cards.has('P0003'));
  assert.equal(JSON.stringify(data), original);
  assert.equal(layoutGraph(graph).cards.size, 75);
  assert.ok(descendants(graph, 'P0007').has('P0044'));
});
test('支系切換保持推測記載獨立、不產生跨支系邊', () => {
  const layout = layoutGraph(graph, {branch:'B02'});
  assert.equal(layout.cards.size, 31);
  assert.ok(!layout.links.some(r => r.fromId === 'P0045'));
  assert.ok([...layout.cards.values()].every(c => c.person.branchId === 'B02'));
});
test('姓名、別名、同名搜尋不合併 ID', () => {
  assert.equal(searchPeople(data.people, '崑利')[0].id, 'P0053');
  assert.equal(searchPeople(data.people, '葉阿送')[0].id, 'P0005');
  assert.equal(searchPeople(data.people, '忠雄')[0].id, 'P0050');
  assert.equal(searchPeople(data.people, '不存在').length, 0);
  assert.equal(searchPeople([...data.people,{...data.people[0],id:'another'}], '葉公名妻').length, 2);
});
test('多位配偶、雙親、女性上代與未知上代均不複製或錯配人物', () => {
  const synthetic = clone();
  const a = synthetic.people.find(p=>p.id==='P0001'), b=synthetic.people.find(p=>p.id==='P0002'), c=synthetic.people.find(p=>p.id==='P0003');
  const extra = {...structuredClone(b), id:'P9999', name:'測試配偶', spouseIds:[a.id]};
  synthetic.people.push(extra); a.spouseIds.push(extra.id);
  synthetic.relationships.push({id:'multi',type:'spouse',fromId:a.id,toId:extra.id,status:'source-supported',source:{pages:[1],evidence:'測試'}});
  b.gender='female'; c.parentIds.push(b.id); c.motherId=b.id;
  synthetic.relationships.push({id:'both',type:'parent-child',fromId:b.id,toId:c.id,status:'source-supported',source:{pages:[1],evidence:'測試'}});
  const layout = layoutGraph(buildGraph(synthetic));
  assert.equal(layout.cards.size,76); noOverlap(layout);
  assert.ok(layout.links.some(r=>r.fromId===b.id && r.toId===c.id));
  assert.ok(!layout.links.some(r=>r.fromId===extra.id && r.toId===c.id));
});
