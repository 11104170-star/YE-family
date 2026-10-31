import { buildGraph, layoutGraph, descendants } from './layout.js';
import { generationLabel, personDisplayName, personGenerationLabel } from './format.js';
import { isConfirmedRelationship } from './relationships.js';

export class FamilyTree {
  constructor(data, { onSelect, onBranchChange }) {
    this.data = data;
    this.graph = buildGraph(data);
    this.onSelect = onSelect;
    this.onBranchChange = onBranchChange;
    this.branch = data.branches[0]?.id || 'all';
    this.photos = new Set();
    this.selected = null;
    this.svg = d3.select('#tree-svg');
    this.world = this.svg.append('g').attr('class', 'world');
    this.zoom = d3.zoom().scaleExtent([0.06, 2.4]).clickDistance(6)
      .filter(event => (event.type.startsWith('touch') || !event.target.closest?.('button')) && (!event.ctrlKey || event.type === 'wheel') && !event.button)
      .on('zoom', event => {
        this.world.attr('transform', event.transform);
        document.querySelector('#zoom-level').textContent = `${Math.round(event.transform.k * 100)}%`;
      });
    this.svg.call(this.zoom).on('dblclick.zoom', null);
    this.reset();
    this.resizeObserver = new ResizeObserver(() => {
      const rect = this.svg.node().getBoundingClientRect();
      this.zoom.extent([[0, 0], [rect.width, rect.height]]);
    });
    this.resizeObserver.observe(this.svg.node());
    this.loadPhotoMetadata();
  }

  async loadPhotoMetadata() {
    // HEAD 僅確認檔案存在；影像本體由卡片 loading=lazy 載入。
    const photos = this.data.people.filter(p => p.photo);
    await Promise.all(photos.map(async p => {
      try {
        const response = await fetch(p.photo, { method: 'HEAD' });
        if (response.ok && response.headers.get('content-type')?.startsWith('image/')) this.photos.add(p.id);
      } catch { /* 缺檔或離線時省略照片。 */ }
    }));
    if (photos.length) this.render();
  }

  reset() {
    this.collapsed = new Set([...this.graph.units.values()].filter(u => u.generation >= 18 && u.children.length).map(u => u.id));
    this.selected = null;
    this.render(); this.fit(true);
  }

  setBranch(branch) {
    this.branch = branch;
    this.onBranchChange?.(branch);
    this.render(); this.fit(true);
  }

  expandAll() { this.collapsed.clear(); this.render(); }

  toggle(unitId) {
    if (this.collapsed.has(unitId)) this.collapsed.delete(unitId);
    else this.collapsed.add(unitId);
    const transform = d3.zoomTransform(this.svg.node());
    const previous = this.layout.nodes.get(unitId);
    const point = previous && transform.apply([previous.x, previous.y]);
    this.render();
    const current = this.layout.nodes.get(unitId);
    if (point && current) this.svg.call(this.zoom.transform, d3.zoomIdentity.translate(point[0] - current.x * transform.k, point[1] - current.y * transform.k).scale(transform.k));
    // 重繪後恢復鍵盤焦點。
    this.world.select(`[data-collapse="${unitId}"]`).node()?.focus({ preventScroll: true });
  }

  focusPerson(id, open = true) {
    const person = this.graph.people.get(id);
    if (!person) return;
    if (this.branch !== 'all' && this.branch !== person.branchId) {
      this.branch = person.branchId;
      this.onBranchChange?.(this.branch);
    }
    const queue = [this.graph.personUnit.get(id)], visited = new Set();
    while (queue.length) {
      const current = queue.pop();
      if (visited.has(current)) continue;
      visited.add(current); this.collapsed.delete(current);
      queue.push(...this.graph.units.get(current).parents);
    }
    this.selected = id; this.render();
    const card = this.layout.cards.get(id);
    if (card) {
      const rect = this.svg.node().getBoundingClientRect();
      const scale = Math.min(1.15, Math.max(.8, d3.zoomTransform(this.svg.node()).k));
      this.svg.call(this.zoom.transform, d3.zoomIdentity.translate(rect.width / 2 - (card.x + card.width / 2) * scale, rect.height * .38 - (card.y + card.height / 2) * scale).scale(scale));
    }
    if (open) this.onSelect?.(person);
  }

  scale(factor) { this.svg.call(this.zoom.scaleBy, factor); }

  fit(defaultView = false) {
    const { width, height } = this.svg.node().getBoundingClientRect();
    if (!width || !height) return;
    let scale = Math.min(.97, (width - 60) / this.layout.width, (height - 70) / this.layout.height);
    let x = (width - this.layout.width * scale) / 2, y = (height - this.layout.height * scale) / 2;
    if (defaultView && width < 650) {
      scale = .78;
      const root = [...this.layout.nodes.values()].find(n => n.people.some(p => p.recordType === 'person'));
      x = width / 2 - root.x * scale; y = 24 - root.y * scale;
    }
    this.svg.call(this.zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
  }

  render() {
    this.layout = layoutGraph(this.graph, { branch: this.branch, collapsed: this.collapsed, photos: this.photos });
    const { cards, individualLinks, families, nodes, rowY } = this.layout;
    this.world.selectAll('*').remove();
    const guides = this.world.append('g').attr('aria-hidden', 'true');
    for (const [generation, y] of rowY) {
      guides.append('line').attr('class', 'generation-rule').attr('x1', 10).attr('x2', this.layout.width - 20).attr('y1', y - 23).attr('y2', y - 23);
      guides.append('text').attr('class', 'generation-label').attr('x', 14).attr('y', y - 32).text(generationLabel(generation));
    }
    const edgeLayer = this.world.append('g').attr('aria-hidden', 'true');
    edgeLayer.selectAll('.individual-link').data(individualLinks, r => r.id).join('path').attr('class', 'parent-link individual-link').attr('data-from', r => r.fromId).attr('data-to', r => r.toId)
      .attr('d', r => {
        const a = cards.get(r.fromId), b = cards.get(r.toId);
        const x1 = a.x + a.width / 2, y1 = a.y + a.height, x2 = b.x + b.width / 2, y2 = b.y;
        const unit = nodes.get(a.unitId);
        const mid = unit.y + unit.height + 62;
        return `M${x1},${y1}V${mid}H${x2}V${y2}`;
      });
    edgeLayer.selectAll('.family-link').data(families, family => family.id).join('path')
      .attr('class', 'parent-link family-link').attr('data-parents', family => family.parentIds.join(' ')).attr('data-children', family => family.childIds.join(' '))
      .attr('d', family => {
        const children = family.childIds.map(id => cards.get(id));
        const xs = children.map(c => c.x + c.width / 2);
        return `M${family.x},${family.y}V${family.busY}M${Math.min(family.x, ...xs)},${family.busY}H${Math.max(family.x, ...xs)}` + children.map((c, i) => `M${xs[i]},${family.busY}V${c.y}`).join('');
      });
    const marriages = this.data.relationships.filter(r => r.type === 'spouse' && isConfirmedRelationship(r) && cards.has(r.fromId) && cards.has(r.toId));
    edgeLayer.selectAll('.spouse-link').data(marriages).join('path').attr('class', 'spouse-link').attr('data-from', r => r.fromId).attr('data-to', r => r.toId).attr('d', (r, i) => {
      const a = cards.get(r.fromId), b = cards.get(r.toId);
      if (Math.abs(a.x - b.x) < 180) {
        const first = a.x < b.x ? a : b, second = first === a ? b : a;
        const y = a.y + Math.min(a.height, b.height) / 2;
        return `M${first.x + first.width},${y - 2}H${second.x}M${first.x + first.width},${y + 2}H${second.x}`;
      }
      // 多位配偶不以穿過其他人物卡的直線連接。
      const y = a.y - 10 - i * 5;
      return `M${a.x + a.width / 2},${a.y}V${y}H${b.x + b.width / 2}V${b.y}`;
    });
    const cardLayer = this.world.append('g');
    for (const c of cards.values()) {
      const p = c.person;
      const fo = cardLayer.append('foreignObject').attr('class', 'node-host').attr('x', c.x).attr('y', c.y).attr('width', c.width).attr('height', c.height);
      const button = fo.append('xhtml:button').attr('type', 'button').attr('class', `person-card${p.id === this.selected ? ' selected' : ''}${p.recordType === 'ancestor-note' ? ' pending' : ''}`).attr('data-person-id', p.id)
        .attr('aria-label', `${personDisplayName(p)}，${personGenerationLabel(p)}${p.recordType === 'ancestor-note' ? '，待考證' : ''}，查看詳細資料`)
        .on('click', event => { event.stopPropagation(); this.selected = p.id; this.world.selectAll('.person-card').classed('selected', function () { return this.dataset.personId === p.id; }); this.onSelect?.(p); });
      if (this.photos.has(p.id)) {
        button.append('xhtml:img').attr('src', p.photo).attr('alt', `${p.name}的照片`).attr('loading', 'lazy').attr('decoding', 'async').on('error', () => { this.photos.delete(p.id); this.render(); });
      }
      const copy = button.append('xhtml:span').attr('class', 'card-copy');
      copy.append('xhtml:strong').attr('class', personDisplayName(p).length > 5 ? 'long-name' : null).text(personDisplayName(p));
      copy.append('xhtml:small').text(p.recordType === 'ancestor-note' ? '第十六世（推測）· 待考證' : p.generation ? personGenerationLabel(p) : '配偶 · 世代未註');
    }
    const toggles = this.world.append('g');
    for (const unit of nodes.values()) {
      if (!unit.children.length) continue;
      const isCollapsed = this.collapsed.has(unit.id);
      const count = [...descendants(this.graph, unit.id)].reduce((sum, id) => sum + this.graph.units.get(id).people.filter(p => p.recordType === 'person' && p.lineageRole !== 'spouse').length, 0);
      toggles.append('foreignObject').attr('x', unit.x - 22).attr('y', unit.y + unit.height + 8).attr('width', 44).attr('height', 32)
        .append('xhtml:button').attr('type', 'button').attr('class', 'collapse-button').attr('data-collapse', unit.id).attr('aria-expanded', !isCollapsed)
        .attr('aria-label', `${isCollapsed ? '展開' : '收合'}${unit.people[0].name}的後代，共 ${count} 位`)
        .text(isCollapsed ? `+${count}` : '−').on('click', event => { event.stopPropagation(); this.toggle(unit.id); });
    }
    document.querySelector('#visible-count').textContent = `目前顯示 ${[...cards.values()].filter(c => c.person.recordType === 'person').length} 位人物`;
  }
}
