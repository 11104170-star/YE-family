import { element, personGenerationLabel } from './format.js';
const normalize = value => value.normalize('NFKC').trim().toLocaleLowerCase('zh-Hant');

export function searchPeople(people, query) {
  const q = normalize(query);
  if (!q) return [];
  return people.filter(p => [p.name, ...p.aliases].some(name => normalize(name).includes(q)))
    .sort((a, b) => Number(normalize(b.name) === q) - Number(normalize(a.name) === q));
}

export function initSearch(data, onSelect) {
  const input = document.querySelector('#person-search'), list = document.querySelector('#search-results');
  let matches = [], active = -1;
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
  const select = person => { input.value = person.name; close(); onSelect(person.id); };
  const render = () => {
    matches = searchPeople(data.people, input.value); active = -1;
    list.replaceChildren(); input.removeAttribute('aria-activedescendant');
    if (!input.value.trim()) { close(); return; }
    for (const [index, p] of matches.entries()) {
      const button = element('button', 'search-option', p.name);
      button.id = `result-${p.id}`; button.type = 'button'; button.setAttribute('role', 'option'); button.setAttribute('aria-selected', 'false');
      const branch = data.branches.find(b => b.id === p.branchId);
      const parent = data.people.find(parent => p.parentIds.includes(parent.id));
      button.append(element('span', '', `${personGenerationLabel(p)} · ${branch?.name} · ${parent ? `上代 ${parent.name} · ` : ''}${p.aliases.length ? `別名 ${p.aliases.join('、')} · ` : ''}${p.id}`));
      button.addEventListener('click', () => select(matches[index])); list.append(button);
    }
    if (!matches.length) list.append(element('p', 'search-empty', '沒有找到符合的人物，請試試別名或部分姓名。'));
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
  };
  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close(); return; }
    if (event.key === 'Enter' && matches.length && !list.hidden) { event.preventDefault(); select(matches[Math.max(0, active)]); }
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && matches.length) {
      event.preventDefault();
      if (list.hidden) render();
      active = active === -1 ? (event.key === 'ArrowDown' ? 0 : matches.length - 1) : (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      [...list.children].forEach((el, i) => { el.classList.toggle('active', i === active); el.setAttribute('aria-selected', String(i === active)); });
      input.setAttribute('aria-activedescendant', `result-${matches[active].id}`);
      list.children[active]?.scrollIntoView({ block: 'nearest' });
    }
  });
  document.addEventListener('click', event => { if (!event.target.closest('.search-wrap')) close(); });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { event.preventDefault(); input.focus(); }
  });
}
