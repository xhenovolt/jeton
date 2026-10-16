// Unit tests for the clause engine's pure functions: selection validation and
// composition. No test framework is installed in this repository, so these are
// plain assertions.
//
//   npm run test
//
import { validateSelection, composeClauses } from '@/lib/document-clauses.js';

let fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
};
const truthy = (name, cond, note = '') => {
  if (!cond) fail++;
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}${cond || !note ? '' : '\n        ' + note}`);
};

/** A profile clause row shaped as `getProfileClauses` returns one. */
const clause = (id, name, over = {}) => ({
  clause_id: id,
  code: `c.${id}`,
  name,
  category: 'confidentiality',
  status: 'published',
  inclusion: 'required',
  sort_order: 0,
  incompatible_with: [],
  applicable_document_types: [],
  version_id: `v-${id}`,
  version: 1,
  version_name: name,
  version_body: `<p>${name} applies to {{recipient_name}}.</p>`,
  version_body_format: 'html',
  ...over,
});

console.log('\n── required clauses cannot be dropped');
{
  const set = [clause('a', 'Alpha'), clause('b', 'Beta', { inclusion: 'optional' })];
  const r = validateSelection(set, []);        // caller selected nothing
  truthy('a required clause is added back', r.resolved.some(c => c.clause_id === 'a'));
  truthy('and the caller is told', r.warnings.some(w => /required/i.test(w)));
  truthy('an optional clause is NOT added', !r.resolved.some(c => c.clause_id === 'b'));
  t('still valid', r.ok, true);
}

console.log('\n── clauses outside the profile are rejected');
{
  const r = validateSelection([clause('a', 'Alpha')], ['a', 'zz']);
  t('not ok', r.ok, false);
  truthy('names the stray clause', r.errors.some(e => e.includes('zz')));
}

console.log('\n── unusable clauses are rejected with a reason');
{
  const noVersion = clause('a', 'Alpha', { version_id: null, inclusion: 'optional' });
  const r1 = validateSelection([noVersion], ['a']);
  t('unpublished -> not ok', r1.ok, false);
  truthy('explains that it needs publishing',
    r1.errors.some(e => /no published version/i.test(e)), r1.errors.join('; '));

  for (const status of ['deprecated', 'archived']) {
    const c = clause('a', 'Alpha', { status, inclusion: 'optional' });
    const r = validateSelection([c], ['a']);
    t(`${status} -> not ok`, r.ok, false);
    truthy(`says it is ${status}`, r.errors.some(e => e.includes(status)));
  }

  const draft = clause('a', 'Alpha', { status: 'draft', inclusion: 'optional' });
  const r2 = validateSelection([draft], ['a']);
  t('draft -> not ok', r2.ok, false);

  // 'approved' is cleared for use, like 'published'.
  const appr = clause('a', 'Alpha', { status: 'approved', inclusion: 'optional' });
  t('approved -> ok', validateSelection([appr], ['a']).ok, true);
}

console.log('\n── document-type restriction');
{
  const nda = clause('a', 'Alpha', { applicable_document_types: ['nda'], inclusion: 'optional' });
  t('matching type is allowed', validateSelection([nda], ['a'], { documentType: 'nda' }).ok, true);
  const wrong = validateSelection([nda], ['a'], { documentType: 'offer_letter' });
  t('wrong type is refused', wrong.ok, false);
  truthy('names the type', wrong.errors.some(e => e.includes('offer_letter')));

  // An empty restriction means "any type". This is the case that regressed
  // once already: a transport that renders an empty Postgres array as ['']
  // made every clause look inapplicable.
  const any = clause('a', 'Alpha', { applicable_document_types: [], inclusion: 'optional' });
  t('empty restriction allows any type', validateSelection([any], ['a'], { documentType: 'nda' }).ok, true);
  const blank = clause('a', 'Alpha', { applicable_document_types: [''], inclusion: 'optional' });
  t("[''] is treated as no restriction", validateSelection([blank], ['a'], { documentType: 'nda' }).ok, true);
  const nullish = clause('a', 'Alpha', { applicable_document_types: null, inclusion: 'optional' });
  t('null restriction allows any type', validateSelection([nullish], ['a'], { documentType: 'nda' }).ok, true);
}

console.log('\n── incompatibility is symmetric');
{
  const a = clause('a', 'Alpha', { incompatible_with: ['b'] });
  const b = clause('b', 'Beta', { incompatible_with: [] });      // declares nothing
  const r = validateSelection([a, b], ['a', 'b']);
  t('a one-sided declaration still bites', r.ok, false);
  truthy('names both clauses',
    r.errors.some(e => e.includes('Alpha') && e.includes('Beta')), r.errors.join('; '));

  // And the other direction.
  const c = clause('c', 'Gamma', { incompatible_with: [] });
  const d = clause('d', 'Delta', { incompatible_with: ['c'] });
  t('reverse declaration also bites', validateSelection([c, d], ['c', 'd']).ok, false);

  // One error per pair, not two.
  t('one message per pair', validateSelection([a, b], ['a', 'b']).errors.length, 1);

  // A clause on its own is fine even if it declares an incompatibility.
  t('alone is fine', validateSelection([a], ['a']).ok, true);
}

console.log('\n── ordering');
{
  const set = [
    clause('c', 'Gamma', { sort_order: 2 }),
    clause('a', 'Alpha', { sort_order: 0 }),
    clause('b', 'Beta', { sort_order: 1 }),
  ];
  const r = validateSelection(set, ['a', 'b', 'c']);
  t('resolved in sort_order', r.resolved.map(c => c.name), ['Alpha', 'Beta', 'Gamma']);
}

console.log('\n── composition');
{
  const set = [clause('a', 'Alpha', { sort_order: 0 }), clause('b', 'Beta', { sort_order: 1 })];
  const r = validateSelection(set, ['a', 'b']);
  const out = composeClauses(r.resolved, { recipient_name: 'Ada Lovelace' });

  truthy('numbers the clauses', out.html.includes('1. Alpha') && out.html.includes('2. Beta'));
  truthy('substitutes placeholders', out.html.includes('Ada Lovelace'));
  truthy('leaves no placeholders', !/\{\{[^}]*\}\}/.test(out.html));
  t('manifest length', out.manifest.length, 2);
  t('manifest records version ids', out.manifest.map(m => m.clause_version_id), ['v-a', 'v-b']);
  t('manifest records order', out.manifest.map(m => m.sort_order), [0, 1]);
  t('no missing values', out.missing, []);

  // A value the clause needs but nobody supplied must be reported, not blanked.
  const out2 = composeClauses(r.resolved, {});
  t('missing values are reported', out2.missing, ['recipient_name']);
  truthy('and no "undefined" leaks into the text', !/undefined/.test(out2.html));

  // An untrusted value cannot inject markup.
  const out3 = composeClauses(r.resolved, { recipient_name: '<script>alert(1)</script>' });
  truthy('untrusted values are escaped',
    !out3.html.includes('<script>') && out3.html.includes('&lt;script&gt;'));

  // A clause code with a quote cannot break out of the data attribute.
  const evil = clause('e', 'Evil', { code: 'x" onload="alert(1)', sort_order: 0 });
  const out4 = composeClauses([evil], { recipient_name: 'x' });
  truthy('clause code is attribute-escaped', !out4.html.includes('onload="alert'));
}

console.log('\n── composition of an empty set');
{
  const out = composeClauses([], {});
  t('no html', out.html, '');
  t('no manifest', out.manifest, []);
}

console.log(fail === 0
  ? '\nclause-engine: all assertions passed.'
  : '\nclause-engine: ' + fail + ' assertion(s) FAILED');
process.exit(fail ? 1 : 0);
