// Node test for the document template engine. No test framework is installed
// in this repository, so these are plain assertions run by `npm run test:docs`.
import * as E from '../src/lib/document-template-engine.js';
let fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
};

// --- the XSS hole that existed before
t('script in a value is escaped',
  E.render('Hello {{name}}', { name: '<script>alert(1)</script>' }).html,
  'Hello &lt;script&gt;alert(1)&lt;/script&gt;');
t('img onerror in a value is escaped',
  E.render('{{n}}', { n: '<img src=x onerror=alert(1)>' }).html,
  '&lt;img src=x onerror=alert(1)&gt;');
t('quotes escaped (attribute safety)',
  E.render('{{n}}', { n: `a"b'c&d` }).html,
  'a&quot;b&#39;c&amp;d');

// --- regex injection: a data key with metacharacters must not break anything
t('regex metacharacter key is inert',
  E.render('x{{a}}y', { 'a': 'V', 'a.*': 'BAD', '(': 'X' }).html, 'xVy');
t('template containing regex metacharacters survives',
  E.render('cost is $1.00 (approx) [net] {{v}}', { v: '5' }).html,
  'cost is $1.00 (approx) [net] 5');

// --- missing values: reported, never invented
const miss = E.render('Salary: {{salary}} Start: {{start}}', { salary: 0 });
t('zero is PRESENT, not missing', miss.missing, ['start']);
t('zero renders as 0', miss.html, 'Salary: 0 Start: ');
t('false is present', E.render('{{f}}', { f: false }).html, 'No');
t('empty string is missing', E.render('{{e}}', { e: '   ' }).missing, ['e']);
t('null is missing', E.render('{{n}}', { n: null }).missing, ['n']);
t('no "undefined" or "null" ever reaches output',
  /undefined|null/.test(E.render('{{a}}{{b}}', { a: undefined, b: null }).html), false);

// --- conditionals
t('if included when present', E.render('A{{#if x}}B{{/if}}C', { x: 1 }).html, 'ABC');
t('if skipped when absent',  E.render('A{{#if x}}B{{/if}}C', {}).html, 'AC');
t('if/else takes else',      E.render('{{#if x}}Y{{else}}N{{/if}}', {}).html, 'N');
t('if/else takes then',      E.render('{{#if x}}Y{{else}}N{{/if}}', { x: 'v' }).html, 'Y');
t('unless inverts',          E.render('{{#unless x}}N{{/unless}}', {}).html, 'N');
t('false fails #if',         E.render('{{#if x}}Y{{else}}N{{/if}}', { x: false }).html, 'N');
t('vars in a skipped branch are not reported missing',
  E.render('{{#if x}}{{deep}}{{/if}}', {}).missing, []);
t('nested conditionals',
  E.render('{{#if a}}1{{#if b}}2{{/if}}3{{/if}}', { a: 1 }).html, '13');
t('unbalanced template reports an error',
  E.render('{{#if a}}x', { a: 1 }).errors.length > 0, true);
t('stray close reports an error',
  E.render('x{{/if}}', {}).errors.length > 0, true);

// --- dotted paths
t('dotted path reads nested data',
  E.render('{{employee.department}}', { employee: { department: 'Engineering' } }).html, 'Engineering');
t('dotted path missing is reported',
  E.render('{{employee.salary}}', { employee: {} }).missing, ['employee.salary']);
t('dotted path on a non-object does not throw',
  E.render('{{a.b.c}}', { a: 5 }).missing, ['a.b.c']);

// --- variable discovery
const d = E.describeVariables('{{a}} {{#if b}}{{c}}{{/if}} {{a}}');
t('required vars', d.required, ['a']);
t('optional vars', d.optional, ['c']);
t('condition vars', d.conditions, ['b']);
const d2 = E.describeVariables('{{#if x}}{{a}}{{/if}}{{a}}');
t('var used inside AND outside a branch is required', [d2.required, d2.optional], [['a'], []]);

// --- markdown
t('markdown heading', E.markdownToHtml('# Title'), '<h1>Title</h1>');
t('markdown bold', E.markdownToHtml('**x**'), '<p><strong>x</strong></p>');
t('markdown ul', E.markdownToHtml('- a\n- b'), '<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
t('markdown ol', E.markdownToHtml('1. a\n2. b'), '<ol>\n<li>a</li>\n<li>b</li>\n</ol>');
t('markdown hr', E.markdownToHtml('---'), '<hr />');
t('renderBody escapes value THEN renders markdown (no injected markup)',
  E.renderBody('# {{n}}', 'markdown', { n: '<b>x</b>' }).html, '<h1>&lt;b&gt;x&lt;/b&gt;</h1>');


console.log(fail === 0
  ? '\ntemplate-engine: all assertions passed.'
  : '\ntemplate-engine: ' + fail + ' assertion(s) FAILED');
process.exit(fail ? 1 : 0);
