import fs from 'fs';
import path from 'path';
const ROOT = path.resolve('src');
const RE_COLOR_TEXT = /\btext-(red|blue|green|emerald|amber|yellow|orange|pink|purple|fuchsia|violet|indigo|sky|cyan|teal|rose|lime)-\d{2,3}\b/;
const RE_DARK_TEXT  = /\bdark:text-/;
const RE_DARK_BG    = /\bdark:bg-/;
const RE_LIGHT_COLOR_BG = /\bbg-(red|blue|green|emerald|amber|yellow|orange|pink|purple|fuchsia|violet|indigo|sky|cyan|teal|rose|lime)-(50|100)\b/;
const RE_LIGHT_HOVER_BG = /\bhover:bg-(red|blue|green|emerald|amber|yellow|orange|pink|purple|fuchsia|violet|indigo|sky|cyan|teal|rose|lime)-(50|100)\b/;
const RE_DARK_HOVER_BG = /\bdark:hover:bg-/;
const RE_CLASSNAME_STR  = /className\s*=\s*"([^"]*)"/g;
const RE_CLASSNAME_TPL  = /className\s*=\s*\{\s*`([^`]*)`\s*\}/g;
let b1=0,b2=0,b3=0;
function inspect(file) {
  const text = fs.readFileSync(file, 'utf8');
  for (const re of [RE_CLASSNAME_STR, RE_CLASSNAME_TPL]) {
    let m;
    while ((m = re.exec(text))) {
      const cls = m[1];
      if (RE_DARK_BG.test(cls) && RE_COLOR_TEXT.test(cls) && !RE_DARK_TEXT.test(cls)) b1++;
      if (RE_LIGHT_COLOR_BG.test(cls) && RE_COLOR_TEXT.test(cls) && !RE_DARK_BG.test(cls)) b2++;
      if (RE_LIGHT_HOVER_BG.test(cls) && !RE_DARK_HOVER_BG.test(cls)) b3++;
    }
  }
}
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(name)) inspect(p);
  }
}
walk(ROOT);
console.log('bug1 dark:bg + hardcoded text-color, no dark:text:', b1);
console.log('bug2 light bg-color-50/100 + hardcoded text-color, no dark:bg:', b2);
console.log('bug3 hover:bg-color-50/100 with no dark:hover:bg:', b3);
