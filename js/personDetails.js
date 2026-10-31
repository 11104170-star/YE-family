import { element, personDisplayName, personGenerationLabel } from './format.js';
import { isConfirmedRelationship } from './relationships.js';

export class PersonDetails {
  constructor(data, onNavigate) {
    this.data = data; this.onNavigate = onNavigate;
    this.people = new Map(data.people.map(p => [p.id, p]));
    this.dialog = document.querySelector('#person-dialog');
    this.content = document.querySelector('#person-content');
    document.querySelector('#close-details').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('click', event => {
      const rect = this.dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientY < rect.top || event.clientX > rect.right || event.clientY > rect.bottom) this.dialog.close();
    });
    this.dialog.addEventListener('close', () => {
      document.body.style.overflow = '';
      const target = this.returnFocus?.isConnected ? this.returnFocus : document.querySelector(`[data-person-id="${this.currentId}"]`);
      target?.focus({ preventScroll: true });
    });
  }

  show(person) {
    if (!this.dialog.open) this.returnFocus = document.activeElement;
    this.currentId = person.id;
    this.content.replaceChildren();
    const heading = element('div', 'person-heading');
    heading.append(element('p', 'eyebrow', this.data.branches.find(b => b.id === person.branchId)?.name));
    const name = element('h2', '', personDisplayName(person)); name.id = 'person-name';
    heading.append(name, element('span', 'person-id', `${personGenerationLabel(person)}${person.generationStatus === 'inferred' ? '（推測）' : ''}　·　${person.id}`));
    this.content.append(heading);
    if (person.photo) {
      const img = element('img', 'detail-photo');
      img.alt = `${person.name}的照片`; img.loading = 'lazy'; img.decoding = 'async';
      img.addEventListener('error', () => img.remove()); img.src = person.photo;
      this.content.append(img);
    }
    if (person.reviewNotes) this.content.append(element('p', 'detail-notice', person.reviewNotes));
    const dl = element('dl', 'details-list');
    const field = (title, value) => {
      if (!value) return;
      const row = element('div'); row.append(element('dt', '', title));
      const dd = element('dd');
      if (typeof value === 'string') dd.textContent = value; else dd.append(value);
      row.append(dd); dl.append(row);
    };
    const relatives = ids => {
      if (!ids.length) return null;
      const container = element('div', 'detail-relations');
      for (const id of ids) {
        const relative = this.people.get(id);
        if (!relative) continue;
        const button = element('button', 'relative-link', personDisplayName(relative));
        button.type = 'button'; button.title = `${personGenerationLabel(relative)} · ${relative.id}`;
        button.addEventListener('click', () => this.onNavigate(id)); container.append(button);
      }
      return container;
    };
    field('其他姓名／別名', person.aliases.join('、'));
    if (person.generation) field('世代', `${personGenerationLabel(person)}${person.generationStatus === 'inferred' ? '（原文推測）' : ''}`);
    if (person.lineageRole === 'spouse') field('家族身分', '配偶（非葉氏血緣後代）');
    if (person.gender) field(person.source.type === 'family-confirmation' ? '性別（家族補充）' : '性別（原文註記）', person.gender === 'female' ? '女' : person.gender === 'male' ? '男' : person.gender);
    field('父親', person.fatherId ? relatives([person.fatherId]) : null);
    field('母親', person.motherId ? relatives([person.motherId]) : null);
    field('上代（原文未註明父／母）', relatives(person.parentIds.filter(id => ![person.fatherId, person.motherId].includes(id))));
    field('配偶', relatives(person.spouseIds));
    const children = this.data.relationships.filter(r => r.type === 'parent-child' && isConfirmedRelationship(r) && r.fromId === person.id).map(r => r.toId);
    field('子女（依記載及家族確認）', relatives(children));
    // UI 與資料驗證雙重保護；在世／狀態未知時僅呈現年份。
    field('出生', person.birthDate ? (person.deathDate ? person.birthDate : person.birthDate.match(/^\d{4}/)?.[0]) : null);
    field('過世', person.deathDate);
    field('人物介紹', person.biography);
    field(person.source.type === 'family-confirmation' ? '家族補充備註' : '原文備註', person.notes);
    for (const relation of this.data.relationships.filter(r => r.status === 'pending' && [r.fromId, r.toId].includes(person.id))) {
      const pending = element('div');
      pending.append(element('p', '', relation.note), relatives([relation.fromId === person.id ? relation.toId : relation.fromId]));
      field('待考證記載（未建立親子連線）', pending);
    }
    const source = person.source.type === 'family-confirmation'
      ? `資料來源：家族補充確認（${person.source.date}）。`
      : `資料來源：原始族譜 PDF，第 ${person.source.page} 頁。`;
    const supplementary = person.source.type !== 'family-confirmation' && person.confirmationIds?.length ? '\n親屬關係另含家族補充確認。' : '';
    this.content.append(dl, element('p', 'source-caption', `${source}${supplementary}\n未列出的欄位表示尚無資料。`));
    if (!this.dialog.open) this.dialog.showModal();
    document.body.style.overflow = 'hidden'; this.dialog.scrollTop = 0;
    document.querySelector('#close-details').focus({ preventScroll: true });
  }
}
