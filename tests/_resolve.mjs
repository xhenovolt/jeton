/**
 * Resolve the project's `@/...` import alias for plain Node, so library
 * modules can be unit-tested without a bundler.
 *
 * `@/lib/db.js` is replaced with a stub that throws if it is ever called. The
 * tests that use this loader exercise PURE functions only; a stub that throws
 * means a test which accidentally reaches the database fails loudly instead of
 * silently depending on live data.
 *
 * Usage:  node --import ./tests/_resolve.mjs tests/<name>.test.mjs
 */
import { register } from 'module';
import { pathToFileURL } from 'url';
import { dirname, resolve as resolvePath } from 'path';

const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SRC = resolvePath(here, '..', 'src');
const DB_STUB = pathToFileURL(resolvePath(here, '_db-stub.mjs')).href;

register(`data:text/javascript,
  const SRC = ${JSON.stringify(SRC.replace(/\\\\/g, '/'))};
  const DB_STUB = ${JSON.stringify(DB_STUB)};
  export async function resolve(specifier, context, next) {
    if (specifier === '@/lib/db.js' || specifier === '@/lib/db') {
      return { url: DB_STUB, shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const p = SRC + '/' + specifier.slice(2);
      return { url: 'file:///' + p.replace(/^\\/+/, ''), shortCircuit: true };
    }
    return next(specifier, context);
  }
`);
