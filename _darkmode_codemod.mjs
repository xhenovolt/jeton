// Pass 2 codemod: hover:bg-{color}-50 with no dark:hover:bg-{color}- counterpart
// → append `dark:hover:bg-{color}-900/20`.
import fs from 'fs';
import path from 'path';
const ROOT = path.resolve('src');
const COLORS = ['red','blue','green','emerald','amber','yellow','orange','pink','purple','fuchsia','violet','indigo','sky','cyan','teal','rose','lime'];
const RE_CLASSNAME_STR = /className\s*=\s*"([^"]*)"/g;
const RE_CLASSNAME_TPL = /className\s*=\s*\{\s*`([^`]*)`\s*\}/g;
let total = 0; const filesEdited = [];

function patch(cls) {
  let edited = cls;
  for (const c of COLORS) {
    const reHoverLight = new RegExp(`\\bhover:bg-${c}-(50|100)\\b`);
    if (!reHoverLight.test(edited)) continue;
    const reDark = new RegExp(`\\bdark:hover:bg-${c}-`);
    if (reDark.test(edited)) continue;
    edited = edited.trimEnd() + ` dark:hover:bg-${c}-900/20`;
  }
  return edited;
}
function processFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  let next = text, count = 0;
  for (const re of [RE_CLASSNAME_STR, RE_CLASSNAME_TPL]) {
    next = next.replace(re, (full, inner) => {
      const patched = patch(inner);
      if (patched === inner) return full;
      count++;
      return full.replace(inner, patched);
    });
  }
  if (count > 0) {
    fs.writeFileSync(file, next);
    filesEdited.push({ file: path.relative('.', file), edits: count });
    total += count;
  }
}
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(name)) processFile(p);
  }
}
walk(ROOT);
console.log(`Patched ${total} className(s) across ${filesEdited.length} files`);
for (const e of filesEdited) console.log('  ', e.file, '→', e.edits);
