import { validateData } from './dataValidator.js';
import { FamilyTree } from './familyTree.js';
import { PersonDetails } from './personDetails.js';
import { initSearch } from './search.js';
import { element } from './format.js';

async function start() {
  const response = await fetch('data/family.json');
  if (!response.ok) throw new Error('族譜資料讀取失敗');
  const data = await response.json();
  const report = validateData(data);
  if (!report.valid) throw new Error(`資料驗證未通過：${report.errors.join('；')}`);
  if (!globalThis.d3) throw new Error('D3.js 載入失敗，請確認 assets/vendor 中的檔案');
  document.querySelector('#people-count').textContent = data.people.filter(p => p.recordType === 'person').length;
  document.querySelector('#branch-count').textContent = data.branches.length;
  const generations = data.people.filter(p => p.recordType === 'person' && p.generation).map(p => p.generation);
  document.querySelector('#generation-range').textContent = `${Math.min(...generations)} — ${Math.max(...generations)}`;
  document.querySelector('#review-count').textContent = `${data.reviewItems.length} 項`;
  data.reviewItems.forEach(item => document.querySelector('#review-list').append(element('li', '', item.text)));
  const branchSelect = document.querySelector('#branch-select');
  branchSelect.replaceChildren(...data.branches.map(branch => {
    const option = element('option', '', branch.name); option.value = branch.id; return option;
  }));
  const allBranches = element('option', '', '全部支系（分開顯示）'); allBranches.value = 'all'; branchSelect.append(allBranches);
  const updateBranch = id => {
    branchSelect.value = id;
    document.querySelector('#branch-title').textContent = id === 'all' ? '全部支系' : data.branches.find(b => b.id === id).name;
    document.querySelector('#branch-description').textContent = id === 'all' ? '各支系獨立排列，不建立未知血緣連線' : data.branches.find(b => b.id === id).description;
  };
  const details = new PersonDetails(data, id => tree.focusPerson(id));
  const tree = new FamilyTree(data, { onSelect: person => details.show(person), onBranchChange: updateBranch });
  updateBranch(tree.branch);
  initSearch(data, id => tree.focusPerson(id));
  branchSelect.addEventListener('change', () => tree.setBranch(branchSelect.value));
  document.querySelector('#zoom-in').addEventListener('click', () => tree.scale(1.25));
  document.querySelector('#zoom-out').addEventListener('click', () => tree.scale(.8));
  document.querySelector('#fit-view').addEventListener('click', () => tree.fit());
  document.querySelector('#expand-all').addEventListener('click', () => tree.expandAll());
  document.querySelector('#reset-view').addEventListener('click', () => tree.reset());
  document.querySelector('#load-status').hidden = true;
}

start().catch(error => {
  console.error(error);
  document.querySelector('#load-status').textContent = `無法顯示族譜：${error.message}。請使用 HTTP 本地伺服器開啟，並檢查資料檔案。`;
  document.querySelectorAll('.tree-toolbar button,.tree-toolbar input,.tree-toolbar select,.zoom-controls button').forEach(el => el.disabled = true);
});
