export function generationLabel(generation) {
  if (!generation) return '世代未註';
  const names = {16:'十六',17:'十七',18:'十八',19:'十九',20:'二十',21:'二十一'};
  return `第${names[generation] || generation}世`;
}

export function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

export const personDisplayName = person => person.displayName || person.name;
export const personGenerationLabel = person => `${generationLabel(person.generation)}${person.lineageRole === 'spouse' ? '配偶' : ''}`;
