import { readFile } from 'node:fs/promises';
import { validateData } from '../js/dataValidator.js';
const data = JSON.parse(await readFile(new URL('../data/family.json', import.meta.url), 'utf8'));
const report = validateData(data);
console.log(JSON.stringify(report, null, 2));
if (!report.valid) process.exitCode = 1;
