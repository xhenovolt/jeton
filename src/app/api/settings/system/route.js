import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';
import { getSettings, setSetting, SETTING_DEFINITIONS } from '@/lib/settings.js';

// GET /api/settings/system — current values plus their definitions
export async function GET(request) {
  const perm = await requirePermission(request, 'settings.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const values = await getSettings();
    const data = Object.entries(SETTING_DEFINITIONS).map(([key, def]) => ({
      key,
      value: values[key],
      type: def.type,
      label: def.label,
      description: def.description,
      group: def.group,
      is_default: values[key] === def.default,
    }));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Settings] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load settings' }, { status: 500 });
  }
}

// PUT /api/settings/system — update one or more settings
export async function PUT(request) {
  const perm = await requirePermission(request, 'settings.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const body = await request.json();
    const updates = body && typeof body === 'object' ? body.settings ?? body : {};

    const keys = Object.keys(updates);
    if (keys.length === 0) {
      return NextResponse.json({ success: false, error: 'No settings supplied' }, { status: 400 });
    }

    const unknown = keys.filter(k => !SETTING_DEFINITIONS[k]);
    if (unknown.length) {
      return NextResponse.json(
        { success: false, error: `Unknown setting(s): ${unknown.join(', ')}` }, { status: 400 });
    }

    const before = await getSettings();

    for (const key of keys) {
      try {
        await setSetting(key, updates[key], auth.userId);
      } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 400 });
      }
    }

    // Policy changes are worth an audit trail of their own — especially the
    // one that unlocks deleting money records.
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'UPDATE', 'system_settings', null,
       JSON.stringify(keys.map(k => ({ key: k, from: before[k], to: String(updates[k]) })))]
    ).catch(() => {});

    return NextResponse.json({ success: true, data: await getSettings() });
  } catch (error) {
    console.error('[Settings] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save settings' }, { status: 500 });
  }
}
