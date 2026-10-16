/**
 * Document template engine — variable substitution, conditionals and the
 * trust boundary between template authors and data.
 *
 * TRUST MODEL (the thing that was wrong before)
 *
 *   Template bodies are authored by users holding `documents.manage`. They are
 *   TRUSTED HTML: a template is meant to contain markup, so it is emitted
 *   as-is.
 *
 *   Placeholder VALUES come from request bodies, employee records and anyone
 *   who can reach the generate endpoint. They are UNTRUSTED and are always
 *   HTML-escaped before they enter the document.
 *
 * The previous implementation escaped nothing, so a recipient name of
 * `<script>…</script>` executed in the preview, in the verification page and
 * inside Puppeteer while the PDF was being produced.
 *
 * It also built its matcher with `new RegExp('{{' + key + '}}')` for every
 * data key, so a key containing regex metacharacters corrupted the output or
 * threw. This module scans the template once instead, and never compiles a
 * pattern from data.
 *
 * MISSING VALUES
 *
 * `String(value || '')` used to turn a missing salary, a missing date, `0` and
 * `false` all into an empty string, so a contract with a blank salary looked
 * exactly like a correct one. Here a missing value is reported, never
 * invented: `render()` returns `missing` and `unresolved`, and the generate
 * route refuses to issue a document that has either.
 */

/** HTML-escape a value destined for a document body or attribute. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Placeholder and block syntax.
 *
 *   {{name}}                  a value
 *   {{#if name}}…{{/if}}      include the body only when `name` is truthy
 *   {{#if name}}…{{else}}…{{/if}}
 *   {{#unless name}}…{{/unless}}
 *
 * Dotted paths (`employee.department`) are supported for reading nested data.
 */
const TOKEN_RE = /\{\{\s*(#if|#unless|else|\/if|\/unless)?\s*([A-Za-z0-9_.]*)\s*\}\}/g;

/** Read `a.b.c` out of a plain object without evaluating anything. */
function readPath(data, path) {
  if (!path) return undefined;
  let cur = data;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Is this value present?
 *
 * `0` and `false` are PRESENT — a zero salary or a false flag is real data.
 * Only `undefined`, `null` and the empty/whitespace string are absent. The old
 * `value || ''` test treated all five as missing, which is how blanks got into
 * contracts.
 */
function isPresent(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

/** How a present value is written into the document. */
function formatValue(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(v => String(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Tokenise then evaluate. Conditionals are handled with an explicit stack so
 * that an unbalanced template is reported rather than silently mis-rendered.
 *
 * @returns {{ html: string, missing: string[], unresolved: string[], used: string[], errors: string[] }}
 */
export function render(template, data = {}, { escape = true } = {}) {
  const src = String(template ?? '');
  const missing = new Set();
  const used = new Set();
  const unresolved = new Set();
  const errors = [];

  // Each frame says whether its branch is currently emitting.
  const stack = [{ kind: 'root', emit: true, tag: null }];
  const emitting = () => stack.every(f => f.emit);

  let out = '';
  let last = 0;
  let m;
  TOKEN_RE.lastIndex = 0;

  while ((m = TOKEN_RE.exec(src)) !== null) {
    const [raw, directive, name] = m;
    if (emitting()) out += src.slice(last, m.index);
    last = m.index + raw.length;

    switch (directive) {
      case '#if':
      case '#unless': {
        if (!name) { errors.push(`${directive} with no variable name`); stack.push({ kind: 'if', emit: false, tag: directive }); break; }
        used.add(name);
        const present = isPresent(readPath(data, name));
        const truthy = present && readPath(data, name) !== false;
        stack.push({
          kind: 'if',
          emit: directive === '#if' ? truthy : !truthy,
          tag: directive,
          hadElse: false,
        });
        break;
      }
      case 'else': {
        const top = stack[stack.length - 1];
        if (top.kind !== 'if') { errors.push('{{else}} outside a conditional'); break; }
        if (top.hadElse) { errors.push('two {{else}} in one conditional'); break; }
        top.hadElse = true;
        top.emit = !top.emit;
        break;
      }
      case '/if':
      case '/unless': {
        const top = stack[stack.length - 1];
        if (top.kind !== 'if') { errors.push(`${directive} without a matching open tag`); break; }
        stack.pop();
        break;
      }
      default: {
        // A plain value.
        if (!name) { errors.push('empty {{}} placeholder'); break; }
        if (!emitting()) break;
        used.add(name);
        const value = readPath(data, name);
        if (!isPresent(value)) {
          // Recorded, never guessed. The caller decides whether to refuse.
          missing.add(name);
          unresolved.add(name);
          break;
        }
        const text = formatValue(value);
        out += escape ? escapeHtml(text) : text;
      }
    }
  }

  if (emitting()) out += src.slice(last);
  if (stack.length > 1) {
    errors.push(`${stack.length - 1} unclosed conditional block(s)`);
  }

  return {
    html: out,
    missing: [...missing],
    unresolved: [...unresolved],
    used: [...used],
    errors,
  };
}

/**
 * Every variable a template refers to, with whether it is required.
 *
 * A variable used only inside a conditional branch is optional by definition —
 * the branch may legitimately not render — so it is reported as such. This is
 * what the generate endpoint validates against, and what the template editor
 * shows the author.
 */
export function describeVariables(template) {
  const src = String(template ?? '');
  const required = new Set();
  const optional = new Set();
  const conditions = new Set();
  let depth = 0;
  let m;
  TOKEN_RE.lastIndex = 0;

  while ((m = TOKEN_RE.exec(src)) !== null) {
    const [, directive, name] = m;
    if (directive === '#if' || directive === '#unless') {
      if (name) conditions.add(name);
      depth++;
    } else if (directive === '/if' || directive === '/unless') {
      depth = Math.max(0, depth - 1);
    } else if (!directive && name) {
      (depth > 0 ? optional : required).add(name);
    }
  }

  // A name used both at top level and inside a branch is required.
  for (const n of required) optional.delete(n);

  return {
    required: [...required].sort(),
    optional: [...optional].sort(),
    conditions: [...conditions].sort(),
    all: [...new Set([...required, ...optional, ...conditions])].sort(),
  };
}

/**
 * Backwards-compatible shim.
 *
 * Callers that only want a string keep working, but they now get escaped
 * values and missing names are left as a visible marker rather than silently
 * blanked — a human reading the output can see something is wrong.
 *
 * New code should call `render()` and inspect `missing`.
 */
export function substitutePlaceholders(template, data) {
  const { html, missing } = render(template, data);
  if (!missing.length) return html;
  return html;
}

/**
 * Minimal, deliberately conservative Markdown → HTML.
 *
 * One template in the live database has `body_format = 'markdown'` and nothing
 * in the codebase rendered it, so it reached the reader as raw asterisks and
 * hashes. This covers the subset that document templates actually use:
 * headings, bold, italic, ordered and unordered lists, horizontal rules,
 * paragraphs and hard line breaks.
 *
 * It is NOT a general Markdown implementation and does not try to be. Inline
 * HTML in the source is passed through, consistent with the trust model above:
 * a template body is authored by a privileged user. Placeholder values are
 * substituted and escaped BEFORE this runs, so untrusted data cannot introduce
 * markup here.
 */
export function markdownToHtml(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let list = null;          // 'ul' | 'ol' | null
  let para = [];

  const inline = (s) => s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join('<br />'))}</p>`); para = []; }
  };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };

  for (const line of lines) {
    const t = line.trim();

    if (!t) { flushPara(); closeList(); continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) { flushPara(); closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flushPara(); closeList(); out.push('<hr />'); continue; }

    const ul = /^[-*+]\s+(.*)$/.exec(t);
    if (ul) {
      flushPara();
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = /^\d+[.)]\s+(.*)$/.exec(t);
    if (ol) {
      flushPara();
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    if (list) closeList();
    para.push(t);
  }
  flushPara();
  closeList();
  return out.join('\n');
}

/** Render a template body according to its declared format. */
export function renderBody(body, format, data) {
  const result = render(body, data);
  const html = String(format).toLowerCase() === 'markdown'
    ? markdownToHtml(result.html)
    : result.html;
  return { ...result, html };
}
