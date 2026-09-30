/**
 * /api/auth/passkeys — Device management for the signed-in user
 *
 * GET    → list all registered passkeys
 * PATCH  → rename a passkey   (body: { passkeyId, deviceName })
 * DELETE → revoke a passkey   (body: { passkeyId })
 */

import { z } from 'zod';
import { withRoute, ok, fail } from '@/lib/api/route.js';
import {
  getPasskeysByUserId, renamePasskey, deletePasskey,
} from '@/lib/passkeys.js';

const Rename = z.object({
  passkeyId:  z.string().uuid('passkeyId must be a UUID'),
  deviceName: z.string().trim().min(1, 'deviceName is required').max(64),
});
const Revoke = z.object({
  passkeyId: z.string().uuid('passkeyId must be a UUID'),
});

export const GET = withRoute({ signedIn: true }, async ({ auth }) =>
  ok(await getPasskeysByUserId(auth.userId))
);

export const PATCH = withRoute({ signedIn: true, body: Rename }, async ({ auth, body }) => {
  const updated = await renamePasskey(body.passkeyId, auth.userId, body.deviceName);
  return updated ? ok({ id: body.passkeyId }) : fail(404, 'Passkey not found or not yours');
});

export const DELETE = withRoute({ signedIn: true, body: Revoke }, async ({ auth, body }) => {
  const deleted = await deletePasskey(body.passkeyId, auth.userId);
  return deleted ? ok({ id: body.passkeyId }) : fail(404, 'Passkey not found or not yours');
});
