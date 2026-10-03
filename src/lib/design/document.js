/**
 * Jeton design document model.
 *
 * WHY THIS FILE EXISTS
 *
 * The editor stored a flat array of layers shaped like:
 *   { id, type:'shape'|'text', shape:'rect'|'circle', x, y, width, height,
 *     rotation, opacity, zIndex, color, borderRadius, glass, fontSize,
 *     fontWeight, value }
 *
 * That is enough for coloured rectangles and a line of text, and nothing more.
 * It has no representation for vector paths, groups, gradients, strokes, blend
 * modes, masks, real typography, images, artboards or effects. Every one of
 * those is load-bearing for the stated goal of replacing Illustrator and
 * Photoshop, and none of them can be bolted onto a flat list of absolutely
 * positioned boxes without changing the shape of every document.
 *
 * So the document model is settled first, deliberately, because it is the
 * decision that forces a rewrite if taken wrongly. Tools, canvas and export
 * all follow from it.
 *
 * DESIGN DECISIONS, AND WHY
 *
 * 1. A TREE, not a list. Groups are the single most requested structural
 *    feature and cannot be faked with zIndex. Children are ordered by their
 *    position in `children`, so z-order is the tree itself and there is no
 *    separate zIndex to keep in sync (the old model had both, and they could
 *    disagree).
 *
 * 2. PAINT IS A LIST. `fills` and `strokes` are arrays of paint objects, not a
 *    single `color` string. Illustrator-style multiple fills, gradients and
 *    image fills then need no schema change, and a solid colour is just a list
 *    of one.
 *
 * 3. GEOMETRY IS SEPARATE FROM TRANSFORM. A node has a `transform`
 *    (x, y, width, height, rotation, skew, flip) and a type-specific
 *    `geometry`. Scaling a path must not rewrite its points, and a rect and a
 *    path should transform identically.
 *
 * 4. NON-DESTRUCTIVE BY DEFAULT. Adjustments and effects are described, not
 *    baked. An image layer keeps its source and carries a list of
 *    adjustments, so brightness can be changed twice without compounding loss.
 *
 * 5. VERSIONED, WITH MIGRATION. Documents carry `schemaVersion`. v1 is the
 *    flat shape above; `migrate()` lifts it to v2 losslessly, so the 16
 *    designs already saved open unchanged rather than being discarded.
 *
 * WHAT THIS FILE IS NOT
 *
 * It is the data model and its invariants only — no rendering, no React, no
 * canvas. A renderer consumes it; this file never imports one. That boundary
 * is what lets the same document drive the on-screen canvas, an SVG export and
 * a server-side raster export without three divergent interpretations.
 */

export const SCHEMA_VERSION = 2;

/** Node kinds. Anything structural is a `frame`/`group`; leaves draw. */
export const NODE_TYPES = {
  GROUP: 'group',       // structural container, no paint of its own
  FRAME: 'frame',       // group that clips its children (an artboard-like box)
  RECT: 'rect',
  ELLIPSE: 'ellipse',
  POLYGON: 'polygon',   // regular n-gon, kept as geometry not baked points
  LINE: 'line',
  PATH: 'path',         // arbitrary vector geometry, the Illustrator case
  TEXT: 'text',
  IMAGE: 'image',       // raster, the Photoshop case
};

/** Paint kinds for fills and strokes. */
export const PAINT_TYPES = {
  SOLID: 'solid',
  LINEAR_GRADIENT: 'linear-gradient',
  RADIAL_GRADIENT: 'radial-gradient',
  IMAGE: 'image',
};

/**
 * Blend modes, named to match both CSS `mix-blend-mode` and SVG, so the
 * renderer never has to translate.
 */
export const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference',
  'exclusion', 'hue', 'saturation', 'color', 'luminosity',
];

/** Non-destructive raster adjustments, applied in list order. */
export const ADJUSTMENT_TYPES = [
  'brightness', 'contrast', 'saturation', 'hue-rotate', 'blur', 'sharpen',
  'grayscale', 'sepia', 'invert',
];

// ─────────────────────────────── constructors ───────────────────────────────

export function solid(color, opacity = 1) {
  return { type: PAINT_TYPES.SOLID, color, opacity, visible: true };
}

/**
 * A gradient. `stops` are {offset 0..1, color, opacity}. `angle` is degrees
 * for linear; radial uses `center` and `radius` in normalised 0..1 units so a
 * gradient survives the node being resized.
 */
export function linearGradient(stops, angle = 90) {
  return { type: PAINT_TYPES.LINEAR_GRADIENT, stops, angle, opacity: 1, visible: true };
}

export function radialGradient(stops, center = { x: 0.5, y: 0.5 }, radius = 0.5) {
  return { type: PAINT_TYPES.RADIAL_GRADIENT, stops, center, radius, opacity: 1, visible: true };
}

export function imagePaint(src, fit = 'cover') {
  return { type: PAINT_TYPES.IMAGE, src, fit, opacity: 1, visible: true };
}

export function stroke({ paint = solid('#000000'), width = 1, align = 'center',
                         cap = 'butt', join = 'miter', dash = null } = {}) {
  // `align` matches Illustrator's inside/center/outside stroke alignment.
  return { paint, width, align, cap, join, dash, visible: true };
}

function baseTransform(overrides = {}) {
  return {
    x: 0, y: 0, width: 100, height: 100,
    rotation: 0,          // degrees, clockwise, about the node's own centre
    skewX: 0, skewY: 0,
    flipX: false, flipY: false,
    ...overrides,
  };
}

/**
 * Create a node. Callers pass only what differs from the default, so adding a
 * field here cannot break existing call sites.
 */
export function createNode(type, options = {}) {
  const { transform, geometry, fills, strokes, effects, adjustments, children, ...rest } = options;

  const node = {
    id: options.id || generateId(),
    type,
    name: options.name || defaultName(type),

    transform: baseTransform(transform),

    // Appearance
    fills: fills ?? defaultFills(type),
    strokes: strokes ?? [],
    opacity: options.opacity ?? 1,
    blendMode: options.blendMode ?? 'normal',
    effects: effects ?? [],          // shadows, blurs — described, not baked

    // State
    visible: options.visible ?? true,
    locked: options.locked ?? false,

    // Masking. When true, this node clips the sibling below it, which is how
    // both Illustrator clipping masks and Photoshop layer masks are expressed.
    isMask: options.isMask ?? false,
    clipsContent: options.clipsContent ?? (type === NODE_TYPES.FRAME),

    ...rest,
  };

  // Type-specific geometry, kept out of `transform` so that resizing a node
  // never has to rewrite its points.
  node.geometry = geometry ?? defaultGeometry(type);

  if (type === NODE_TYPES.GROUP || type === NODE_TYPES.FRAME) {
    // Order in this array IS the z-order: later siblings paint on top.
    node.children = children ?? [];
  }
  if (type === NODE_TYPES.IMAGE) {
    node.adjustments = adjustments ?? [];
  }

  return node;
}

function defaultName(type) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function defaultFills(type) {
  if (type === NODE_TYPES.GROUP || type === NODE_TYPES.LINE) return [];
  if (type === NODE_TYPES.TEXT) return [solid('#111111')];
  if (type === NODE_TYPES.IMAGE) return [];
  return [solid('#3b82f6')];
}

function defaultGeometry(type) {
  switch (type) {
    case NODE_TYPES.RECT:
      // Per-corner radii, so one corner can differ — the old model had a
      // single borderRadius.
      return { cornerRadii: [0, 0, 0, 0] };
    case NODE_TYPES.ELLIPSE:
      return { startAngle: 0, endAngle: 360, innerRadius: 0 }; // arcs and donuts
    case NODE_TYPES.POLYGON:
      return { sides: 3, cornerRadius: 0 };
    case NODE_TYPES.LINE:
      return { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
    case NODE_TYPES.PATH:
      // `subpaths` of cubic Bézier anchors. This is the representation that
      // makes real vector editing possible: each anchor carries its own
      // handles, so a pen tool and node editing need no further schema.
      return { subpaths: [], windingRule: 'nonzero' };
    case NODE_TYPES.TEXT:
      return {
        content: 'Text',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 48,
        fontWeight: 400,
        fontStyle: 'normal',
        lineHeight: 1.2,
        letterSpacing: 0,
        textAlign: 'left',
        verticalAlign: 'top',
        textTransform: 'none',
        textDecoration: 'none',
        // 'fixed' keeps the box and wraps; 'auto' grows to the text.
        autoResize: 'auto',
      };
    case NODE_TYPES.IMAGE:
      return { src: null, naturalWidth: null, naturalHeight: null, fit: 'cover' };
    default:
      return {};
  }
}

/** A path anchor: the point plus its two Bézier handles, in node space. */
export function anchor(x, y, handleIn = null, handleOut = null) {
  return { x, y, handleIn, handleOut };
}

export function subpath(anchors, closed = false) {
  return { anchors, closed };
}

export function shadowEffect({ x = 0, y = 4, blur = 8, spread = 0,
                               color = 'rgba(0,0,0,0.25)', inset = false } = {}) {
  return { type: 'shadow', x, y, blur, spread, color, inset, visible: true };
}

export function blurEffect(radius = 4, kind = 'layer') {
  return { type: 'blur', radius, kind, visible: true };
}

export function adjustment(type, value) {
  return { type, value, visible: true };
}

// ──────────────────────────────── document ──────────────────────────────────

/**
 * Create an empty document.
 *
 * `artboards` is a list even when there is one, because multi-artboard is an
 * Illustrator staple and retrofitting it would change every document.
 */
export function createDocument({ name = 'Untitled Design', width = 1080,
                                 height = 1080, background = '#ffffff',
                                 units = 'px', dpi = 72 } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    units,
    dpi,
    colorSpace: 'srgb',
    artboards: [
      {
        id: generateId(),
        name: 'Artboard 1',
        x: 0, y: 0, width, height,
        background,
        children: [],
      },
    ],
    // Reusable definitions referenced by id, so a colour or gradient can be
    // changed once and update everywhere — the basis of a brand kit.
    styles: { colors: {}, textStyles: {}, effects: {} },
    guides: { horizontal: [], vertical: [], gridSize: 8, snapToGrid: false, snapToObjects: true },
  };
}

/** The canvas shape the existing API and thumbnails still expect. */
export function canvasOf(doc) {
  const a = doc.artboards?.[0];
  return a
    ? { width: a.width, height: a.height, background: a.background }
    : { width: 1080, height: 1080, background: '#ffffff' };
}

// ──────────────────────────────── migration ─────────────────────────────────

/**
 * Lift any stored document to the current schema.
 *
 * v1 is the flat `{ canvas, layers[] }` shape. Every v1 layer maps onto a v2
 * node without losing information:
 *
 *   shape+rect     -> rect, borderRadius spread across all four corners
 *   shape+circle   -> ellipse
 *   text           -> text, with value/fontSize/fontWeight into geometry
 *   color          -> fills[0] as a solid paint
 *   glass:true     -> a layer blur effect plus a translucent fill, which is
 *                     what "glass" was approximating
 *   zIndex         -> position in children (sorted), then discarded
 *
 * Unknown layer types are preserved as a rect carrying the original payload
 * under `legacy`, so a document can never silently lose content.
 */
export function migrate(stored) {
  if (!stored || typeof stored !== 'object') return createDocument();

  // Already current.
  if (stored.schemaVersion === SCHEMA_VERSION) return stored;

  // Future version: refuse to guess rather than corrupt it.
  if (typeof stored.schemaVersion === 'number' && stored.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Design was saved with schema v${stored.schemaVersion}, but this build understands v${SCHEMA_VERSION}.`
    );
  }

  const canvas = stored.canvas || {};
  const doc = createDocument({
    name: stored.name || 'Untitled Design',
    width: Number(canvas.width) || 1080,
    height: Number(canvas.height) || 1080,
    background: canvas.background || '#ffffff',
  });

  const layers = Array.isArray(stored.layers) ? stored.layers : [];
  // zIndex ascending becomes array order, with a stable fallback so layers
  // that share a zIndex keep their original relative order.
  const ordered = layers
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (Number(a.l.zIndex ?? a.i) - Number(b.l.zIndex ?? b.i)) || (a.i - b.i))
    .map(({ l }) => l);

  doc.artboards[0].children = ordered.map(migrateLayer);
  return doc;
}

function migrateLayer(l) {
  const transform = {
    x: Number(l.x) || 0,
    y: Number(l.y) || 0,
    width: Number(l.width) || 100,
    height: Number(l.height) || 100,
    rotation: Number(l.rotation) || 0,
  };
  const common = {
    id: l.id,
    opacity: l.opacity == null ? 1 : Number(l.opacity),
    visible: l.visible !== false,
    locked: !!l.locked,
    transform,
  };

  // "glass" was a frosted panel: translucent fill plus a backdrop blur.
  const glassExtras = l.glass
    ? { effects: [blurEffect(12, 'background')], fills: [solid(l.color || '#ffffff', 0.25)] }
    : {};

  if (l.type === 'text') {
    return createNode(NODE_TYPES.TEXT, {
      ...common,
      name: (l.value || 'Text').slice(0, 40),
      fills: [solid(l.color || '#111111')],
      geometry: {
        ...defaultGeometry(NODE_TYPES.TEXT),
        content: l.value ?? '',
        fontSize: Number(l.fontSize) || 48,
        fontWeight: Number(l.fontWeight) || 400,
      },
      ...glassExtras,
    });
  }

  if (l.type === 'image' || l.src) {
    return createNode(NODE_TYPES.IMAGE, {
      ...common,
      name: l.name || 'Image',
      geometry: { ...defaultGeometry(NODE_TYPES.IMAGE), src: l.src ?? null },
    });
  }

  if (l.type === 'shape') {
    if (l.shape === 'circle' || l.shape === 'ellipse') {
      return createNode(NODE_TYPES.ELLIPSE, {
        ...common, name: 'Ellipse', fills: [solid(l.color || '#3b82f6')], ...glassExtras,
      });
    }
    const r = Number(l.borderRadius) || 0;
    return createNode(NODE_TYPES.RECT, {
      ...common,
      name: 'Rectangle',
      fills: [solid(l.color || '#3b82f6')],
      geometry: { cornerRadii: [r, r, r, r] },
      ...glassExtras,
    });
  }

  // Unrecognised: keep the original payload rather than drop the layer.
  return createNode(NODE_TYPES.RECT, {
    ...common,
    name: l.type ? `Unsupported (${l.type})` : 'Unsupported layer',
    fills: [solid(l.color || '#cccccc')],
    legacy: l,
  });
}

/**
 * Flatten a document back to the v1 `{canvas, layers}` shape.
 *
 * Needed because thumbnails, templates and the existing export path still read
 * v1. Lossy by nature — groups are flattened and paths cannot be represented —
 * so it reports what it could not express instead of failing silently.
 */
export function toLegacy(doc) {
  const warnings = [];
  const layers = [];
  let z = 0;

  function walk(nodes, inheritedOpacity = 1) {
    for (const n of nodes || []) {
      if (n.type === NODE_TYPES.GROUP || n.type === NODE_TYPES.FRAME) {
        warnings.push(`Group "${n.name}" was flattened.`);
        walk(n.children, inheritedOpacity * (n.opacity ?? 1));
        continue;
      }
      const fill = (n.fills || []).find(f => f.visible !== false);
      if (fill && fill.type !== PAINT_TYPES.SOLID) {
        warnings.push(`"${n.name}" uses a ${fill.type} fill, exported as a flat colour.`);
      }
      if ((n.strokes || []).length) warnings.push(`Stroke on "${n.name}" was dropped.`);
      if (n.type === NODE_TYPES.PATH) warnings.push(`Path "${n.name}" cannot be represented.`);

      layers.push({
        id: n.id,
        type: n.type === NODE_TYPES.TEXT ? 'text' : n.type === NODE_TYPES.IMAGE ? 'image' : 'shape',
        shape: n.type === NODE_TYPES.ELLIPSE ? 'circle' : 'rect',
        x: n.transform.x, y: n.transform.y,
        width: n.transform.width, height: n.transform.height,
        rotation: n.transform.rotation || 0,
        opacity: (n.opacity ?? 1) * inheritedOpacity,
        zIndex: z++,
        color: fill?.color || '#cccccc',
        borderRadius: n.geometry?.cornerRadii?.[0] || 0,
        ...(n.type === NODE_TYPES.TEXT
          ? { value: n.geometry?.content ?? '', fontSize: n.geometry?.fontSize, fontWeight: n.geometry?.fontWeight }
          : {}),
        ...(n.type === NODE_TYPES.IMAGE ? { src: n.geometry?.src } : {}),
      });
    }
  }

  for (const a of doc.artboards || []) walk(a.children);
  return { canvas: canvasOf(doc), layers, warnings: [...new Set(warnings)] };
}

// ──────────────────────────────── tree utils ────────────────────────────────

/** Depth-first walk over every node, with its parent and index. */
export function walkNodes(doc, visit) {
  function rec(nodes, parent) {
    nodes.forEach((n, i) => {
      visit(n, parent, i);
      if (n.children) rec(n.children, n);
    });
  }
  for (const a of doc.artboards || []) rec(a.children || [], a);
}

export function findNode(doc, id) {
  let found = null;
  walkNodes(doc, (n) => { if (n.id === id) found = n; });
  return found;
}

export function findParent(doc, id) {
  let parent = null;
  walkNodes(doc, (n, p) => { if (n.id === id) parent = p; });
  return parent;
}

/** Immutably replace one node. Returns a new document. */
export function updateNode(doc, id, changes) {
  const next = structuredClone(doc);
  let hit = false;
  walkNodes(next, (n) => {
    if (n.id !== id) return;
    hit = true;
    Object.assign(n, typeof changes === 'function' ? changes(n) : changes);
  });
  return hit ? next : doc;
}

export function removeNode(doc, id) {
  const next = structuredClone(doc);
  function rec(container) {
    const kids = container.children;
    if (!kids) return false;
    const i = kids.findIndex(k => k.id === id);
    if (i !== -1) { kids.splice(i, 1); return true; }
    return kids.some(rec);
  }
  (next.artboards || []).some(rec);
  return next;
}

/** Append a node, to an artboard by default or into a group by id. */
export function addNode(doc, node, parentId = null) {
  const next = structuredClone(doc);
  if (!parentId) {
    (next.artboards[0].children ||= []).push(node);
    return next;
  }
  let placed = false;
  walkNodes(next, (n) => {
    if (n.id === parentId && n.children) { n.children.push(node); placed = true; }
  });
  if (!placed) (next.artboards[0].children ||= []).push(node);
  return next;
}

/**
 * Wrap nodes in a group, placed where the topmost member was.
 *
 * The group's transform is the bounding box of its members, and children are
 * rebased to be relative to it, so moving the group moves its contents.
 */
export function groupNodes(doc, ids) {
  if (!ids?.length) return doc;
  const next = structuredClone(doc);
  const members = [];
  let host = null;
  let insertAt = 0;

  function rec(container) {
    const kids = container.children;
    if (!kids) return;
    for (let i = kids.length - 1; i >= 0; i--) {
      if (ids.includes(kids[i].id)) {
        if (!host) { host = container; insertAt = i; }
        if (container === host) members.unshift(...kids.splice(i, 1));
      } else if (kids[i].children) rec(kids[i]);
    }
  }
  (next.artboards || []).forEach(rec);
  if (!members.length) return doc;

  const minX = Math.min(...members.map(m => m.transform.x));
  const minY = Math.min(...members.map(m => m.transform.y));
  const maxX = Math.max(...members.map(m => m.transform.x + m.transform.width));
  const maxY = Math.max(...members.map(m => m.transform.y + m.transform.height));

  for (const m of members) { m.transform.x -= minX; m.transform.y -= minY; }

  const group = createNode(NODE_TYPES.GROUP, {
    name: 'Group',
    transform: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    children: members,
  });
  host.children.splice(Math.min(insertAt, host.children.length), 0, group);
  return next;
}

/** Dissolve a group, lifting children into its parent with absolute coords. */
export function ungroupNode(doc, groupId) {
  const next = structuredClone(doc);
  function rec(container) {
    const kids = container.children;
    if (!kids) return false;
    const i = kids.findIndex(k => k.id === groupId);
    if (i !== -1) {
      const g = kids[i];
      const lifted = (g.children || []).map(c => ({
        ...c,
        transform: { ...c.transform, x: c.transform.x + g.transform.x, y: c.transform.y + g.transform.y },
        opacity: (c.opacity ?? 1) * (g.opacity ?? 1),
      }));
      kids.splice(i, 1, ...lifted);
      return true;
    }
    return kids.some(rec);
  }
  (next.artboards || []).some(rec);
  return next;
}

// ──────────────────────────────── validation ────────────────────────────────

/**
 * Check a document's invariants. Returns { valid, errors[], warnings[] }.
 *
 * This exists so a malformed document is rejected at the boundary with a
 * specific message, rather than rendering as a blank canvas and leaving the
 * user to guess — the failure mode this codebase has repeatedly produced
 * elsewhere.
 */
export function validateDocument(doc) {
  const errors = [];
  const warnings = [];

  if (!doc || typeof doc !== 'object') {
    return { valid: false, errors: ['Document is not an object'], warnings };
  }
  if (doc.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SCHEMA_VERSION}, got ${doc.schemaVersion}`);
  }
  if (!Array.isArray(doc.artboards) || doc.artboards.length === 0) {
    errors.push('Document must have at least one artboard');
  }

  const seen = new Set();
  const validTypes = new Set(Object.values(NODE_TYPES));

  for (const a of doc.artboards || []) {
    if (!(a.width > 0) || !(a.height > 0)) errors.push(`Artboard "${a.name}" has a non-positive size`);
  }

  walkNodes(doc, (n, parent) => {
    if (!n.id) errors.push(`A node under "${parent?.name ?? 'artboard'}" has no id`);
    else if (seen.has(n.id)) errors.push(`Duplicate node id: ${n.id}`);
    else seen.add(n.id);

    if (!validTypes.has(n.type)) errors.push(`Unknown node type "${n.type}" on ${n.id}`);
    if (!n.transform) errors.push(`Node ${n.id} has no transform`);

    if (n.opacity != null && (n.opacity < 0 || n.opacity > 1)) {
      errors.push(`Node ${n.id} opacity ${n.opacity} is outside 0..1`);
    }
    if (n.blendMode && !BLEND_MODES.includes(n.blendMode)) {
      errors.push(`Node ${n.id} has unknown blendMode "${n.blendMode}"`);
    }
    if (n.children && n.type !== NODE_TYPES.GROUP && n.type !== NODE_TYPES.FRAME) {
      errors.push(`Node ${n.id} is a ${n.type} but has children`);
    }
    if (n.type === NODE_TYPES.IMAGE && !n.geometry?.src) {
      warnings.push(`Image "${n.name}" has no source and will not render`);
    }
    if (n.type === NODE_TYPES.PATH && !(n.geometry?.subpaths?.length)) {
      warnings.push(`Path "${n.name}" has no subpaths and will not render`);
    }
    if (n.legacy) {
      warnings.push(`"${n.name}" came from an older format and may not render as originally drawn`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

// ───────────────────────────────── helpers ──────────────────────────────────

function generateId() {
  // crypto.randomUUID is available in browsers and in Node 19+. The fallback
  // keeps this module usable in any runtime, including during SSR.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'n_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default {
  SCHEMA_VERSION, NODE_TYPES, PAINT_TYPES, BLEND_MODES, ADJUSTMENT_TYPES,
  createDocument, createNode, canvasOf,
  solid, linearGradient, radialGradient, imagePaint, stroke,
  anchor, subpath, shadowEffect, blurEffect, adjustment,
  migrate, toLegacy,
  walkNodes, findNode, findParent, updateNode, removeNode, addNode,
  groupNodes, ungroupNode,
  validateDocument,
};
