import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/version
 *
 * Public — no auth. Returns the current version string plus build
 * metadata for the sidebar badge and the /app/about page.
 *
 * Sources:
 *   version    — VERSION file at repo root (single source of truth,
 *                bumped by scripts/version.js).
 *   commit     — VERCEL_GIT_COMMIT_SHA when deployed to Vercel;
 *                falls back to a short "dev" string locally.
 *   builtAt    — VERCEL_GIT_COMMIT_MESSAGE_TIMESTAMP if present,
 *                else the boot time of this Node process.
 *
 * Everything is cached at module load — this endpoint is called
 * frequently (sidebar badge polls on interval) and the file/env
 * lookup shouldn't happen per request.
 */

const bootedAt = new Date().toISOString();
let cachedVersion = 'unknown';
try {
  cachedVersion = fs.readFileSync(path.resolve(process.cwd(), 'VERSION'), 'utf8').trim();
} catch {
  // Fall back to package.json if VERSION isn't present for some reason.
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    cachedVersion = pkg.version || 'unknown';
  } catch { /* keep 'unknown' */ }
}

const commit    = (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7);
const branch    = process.env.VERCEL_GIT_COMMIT_REF || 'local';
const commitMsg = process.env.VERCEL_GIT_COMMIT_MESSAGE || null;

export async function GET() {
  return NextResponse.json({
    version:   cachedVersion,
    commit,
    branch,
    commitMsg,
    builtAt:   bootedAt,
    env:       process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  }, {
    // Short cache — the value doesn't change until a deploy invalidates
    // the whole function anyway.
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
