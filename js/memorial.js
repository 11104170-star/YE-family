// 敬祖展示層：完全獨立於人物、世代與親屬圖，不建立任何父母或祖先引用。
export const MEMORIAL_BAND_HEIGHT = 248;

export function createMemorialLayout(cards, branches) {
  const visible = [...cards.values()];
  if (!visible.length) return null;
  const minX = Math.min(...visible.map(card => card.x));
  const maxX = Math.max(...visible.map(card => card.x + card.width));
  const centerX = (minX + maxX) / 2;
  return {
    type: 'memorial', label: '堂上歷代始高曾祖',
    x: centerX - 148, y: 24, width: 296, height: 156, centerX,
    connectionLabel: '象徵性敬祖連接・非血緣關係',
    branches: branches.flatMap(branch => {
      const members = visible.filter(card => card.person.branchId === branch.id);
      if (!members.length) return [];
      const left = Math.min(...members.map(card => card.x));
      const right = Math.max(...members.map(card => card.x + card.width));
      return [{ branchId: branch.id, label: branch.name, centerX: (left + right) / 2, y: 244, width: 200, height: 30, kind: 'symbolic' }];
    }),
  };
}

export function renderMemorial(world, memorial) {
  if (!memorial) return;
  const layer = world.append('g').attr('class', 'memorial-layer');
  layer.append('g').attr('aria-hidden', 'true').selectAll('path')
    .data(memorial.branches).join('path').attr('class', 'memorial-link')
    .attr('data-symbolic-branch', branch => branch.branchId)
    .attr('d', branch => `M${memorial.centerX},${memorial.y + memorial.height}V226H${branch.centerX}V${branch.y}`);
  const plaque = layer.append('g').attr('class', 'memorial-node')
    .attr('role', 'group').attr('aria-label', `${memorial.label}；敬奉未登錄與歷代祖先，非具名人物，無世代及親屬身分`)
    .attr('transform', `translate(${memorial.x},${memorial.y})`);
  plaque.append('path').attr('class', 'memorial-tablet')
    .attr('d', 'M18,20H96L108,6H188L200,20H278V142H18Z');
  plaque.append('path').attr('class', 'memorial-frame')
    .attr('d', 'M26,28H100L112,14H184L196,28H270V134H26Z');
  plaque.append('rect').attr('class', 'memorial-base').attr('x', 8).attr('y', 148).attr('width', 280).attr('height', 8).attr('rx', 2);
  plaque.append('text').attr('class', 'memorial-inscription').attr('x', 148).attr('y', 47).text('慎終追遠');
  plaque.append('text').attr('class', 'memorial-title').attr('x', 148).attr('y', 82).text(memorial.label);
  plaque.append('path').attr('class', 'memorial-rule').attr('d', 'M74,100H222');
  plaque.append('text').attr('class', 'memorial-caption').attr('x', 148).attr('y', 121).text('敬奉未登錄與歷代祖先');
  const note = layer.append('g').attr('class', 'memorial-note');
  note.append('rect').attr('x', memorial.centerX - 160).attr('y', 190).attr('width', 320).attr('height', 26).attr('rx', 13);
  note.append('text').attr('x', memorial.centerX).attr('y', 208).text(memorial.connectionLabel);
  const labels = layer.selectAll('.memorial-branch-label').data(memorial.branches).join('g').attr('class', 'memorial-branch-label')
    .attr('transform', branch => `translate(${branch.centerX - branch.width / 2},${branch.y})`);
  labels.append('rect').attr('width', branch => branch.width).attr('height', branch => branch.height).attr('rx', 15);
  labels.append('text').attr('x', branch => branch.width / 2).attr('y', 20).text(branch => branch.label);
}
