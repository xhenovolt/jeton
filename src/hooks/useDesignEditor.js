'use client';

/**
 * useDesignEditor — Core state engine for the Jeton Design Editor
 * Manages layers, selection, undo history, auto-save
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuid } from 'uuid';

const AUTOSAVE_INTERVAL_MS = 5000;
// How many undo steps to retain. Snapshots are whole layer arrays, which is
// cheap for documents of this size and far simpler to reason about than a
// command log.
const HISTORY_LIMIT = 50;

function cloneLayer(layer) {
  return { ...layer, id: uuid() };
}

export function useDesignEditor({ initialDesign, designId }) {
  const [canvas, setCanvas] = useState(
    initialDesign?.canvas || { width: 1080, height: 1080, background: '#ffffff' }
  );
  const [layers, setLayers] = useState(initialDesign?.layers || []);
  const [selectedId, setSelectedId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  /**
   * Undo history.
   *
   * This used to be three pieces of dead state: pushHistory existed but was
   * never called from anywhere, there were no undo/redo functions at all, and
   * the editor imported an Undo2 icon with nothing behind it. So history was
   * recorded nowhere and could not be stepped through.
   *
   * It is now a single ref holding past/future stacks of layer snapshots.
   * A ref rather than state because every mutation reads the current stacks
   * while writing them, and going through setState would mean a mutation could
   * record against a stale stack. Only the counts are mirrored into state, so
   * the toolbar can enable or disable its buttons and re-render when they
   * change.
   */
  const history = useRef({ past: [], future: [] });
  const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 });

  const syncHistoryCounts = useCallback(() => {
    setHistoryCounts({
      undo: history.current.past.length,
      redo: history.current.future.length,
    });
  }, []);

  /**
   * Update layers and record the PREVIOUS state as an undo step.
   *
   * Recording the prior value (rather than the new one) is what makes undo
   * restore what the user actually had. Any new edit clears the redo stack,
   * which is the behaviour every editor has: you cannot redo down a branch you
   * have just diverged from.
   */
  const updateLayers = useCallback((fn, { recordHistory = true } = {}) => {
    setLayers(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      if (next === prev) return prev;          // no-op, nothing to record
      if (recordHistory) {
        history.current.past = [...history.current.past, prev].slice(-HISTORY_LIMIT);
        history.current.future = [];
        syncHistoryCounts();
      }
      setIsDirty(true);
      return next;
    });
  }, [syncHistoryCounts]);

  const undo = useCallback(() => {
    const { past, future } = history.current;
    if (!past.length) return;
    setLayers(current => {
      history.current = {
        past: past.slice(0, -1),
        future: [current, ...future].slice(0, HISTORY_LIMIT),
      };
      syncHistoryCounts();
      setIsDirty(true);
      return past[past.length - 1];
    });
    setSelectedId(null); // the selected layer may no longer exist
  }, [syncHistoryCounts]);

  const redo = useCallback(() => {
    const { past, future } = history.current;
    if (!future.length) return;
    setLayers(current => {
      history.current = {
        past: [...past, current].slice(-HISTORY_LIMIT),
        future: future.slice(1),
      };
      syncHistoryCounts();
      setIsDirty(true);
      return future[0];
    });
    setSelectedId(null);
  }, [syncHistoryCounts]);

  // ─── Layer mutations ────────────────────────────────────────────

  const addLayer = useCallback((layer) => {
    const newLayer = {
      id: uuid(),
      x: 100, y: 100,
      width: 200, height: 200,
      rotation: 0,
      opacity: 1,
      zIndex: layers.length,
      ...layer,
    };
    updateLayers(prev => [...prev, newLayer]);
    setSelectedId(newLayer.id);
  }, [layers.length, updateLayers]);

  const updateLayer = useCallback((id, changes) => {
    updateLayers(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l));
  }, [updateLayers]);

  const removeLayer = useCallback((id) => {
    updateLayers(prev => prev.filter(l => l.id !== id));
    setSelectedId(null);
  }, [updateLayers]);

  const cloneSelected = useCallback(() => {
    if (!selectedId) return;
    // Routed through updateLayers so duplicating is undoable. It previously
    // called setLayers directly, which skipped history entirely.
    let cloneId = null;
    updateLayers(prev => {
      const src = prev.find(l => l.id === selectedId);
      if (!src) return prev;
      const clone = { ...cloneLayer(src), x: src.x + 20, y: src.y + 20, zIndex: prev.length };
      cloneId = clone.id;
      return [...prev, clone];
    });
    if (cloneId) setSelectedId(cloneId);
  }, [selectedId, updateLayers]);

  // ─── Layering ───────────────────────────────────────────────────

  const bringForward = useCallback((id) => {
    updateLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((l, i) => ({ ...l, zIndex: i }));
    });
  }, [updateLayers]);

  const sendBackward = useCallback((id) => {
    updateLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      return next.map((l, i) => ({ ...l, zIndex: i }));
    });
  }, [updateLayers]);

  const bringToFront = useCallback((id) => {
    updateLayers(prev => {
      const layer = prev.find(l => l.id === id);
      if (!layer) return prev;
      const rest = prev.filter(l => l.id !== id);
      return [...rest, layer].map((l, i) => ({ ...l, zIndex: i }));
    });
  }, [updateLayers]);

  const sendToBack = useCallback((id) => {
    updateLayers(prev => {
      const layer = prev.find(l => l.id === id);
      if (!layer) return prev;
      const rest = prev.filter(l => l.id !== id);
      return [layer, ...rest].map((l, i) => ({ ...l, zIndex: i }));
    });
  }, [updateLayers]);

  // ─── Canvas settings ────────────────────────────────────────────

  const updateCanvas = useCallback((changes) => {
    setCanvas(prev => ({ ...prev, ...changes }));
    setIsDirty(true);
  }, []);

  // ─── Save ───────────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (!designId || !isDirty) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/designs/${designId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvas, layers }),
      });
      if (!res.ok) throw new Error('Save failed');
      setIsDirty(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  }, [designId, isDirty, canvas, layers]);

  // Auto-save every 5 seconds when dirty
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(save, AUTOSAVE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [isDirty, save]);

  // ─── Keyboard shortcuts ─────────────────────────────────────────

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
      const STEP = e.shiftKey ? 10 : 1;
      if (!selectedId) return;
      switch (e.key) {
        case 'ArrowUp':    e.preventDefault(); updateLayer(selectedId, { y: (layers.find(l => l.id === selectedId)?.y || 0) - STEP }); break;
        case 'ArrowDown':  e.preventDefault(); updateLayer(selectedId, { y: (layers.find(l => l.id === selectedId)?.y || 0) + STEP }); break;
        case 'ArrowLeft':  e.preventDefault(); updateLayer(selectedId, { x: (layers.find(l => l.id === selectedId)?.x || 0) - STEP }); break;
        case 'ArrowRight': e.preventDefault(); updateLayer(selectedId, { x: (layers.find(l => l.id === selectedId)?.x || 0) + STEP }); break;
        case 'Delete':
        case 'Backspace':  removeLayer(selectedId); break;
        case 'd':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); cloneSelected(); } break;
        case 'Escape':     setSelectedId(null); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, layers, updateLayer, removeLayer, cloneSelected]);

  const selectedLayer = layers.find(l => l.id === selectedId) || null;

  return {
    canvas, layers, selectedId, selectedLayer,
    isDirty, isSaving, saveError, previewMode,
    setSelectedId, setPreviewMode,
    addLayer, updateLayer, removeLayer, cloneSelected,
    bringForward, sendBackward, bringToFront, sendToBack,
    updateCanvas, save,
    // History. canUndo/canRedo let the toolbar disable its buttons instead of
    // offering an action that silently does nothing.
    undo, redo,
    canUndo: historyCounts.undo > 0,
    canRedo: historyCounts.redo > 0,
    undoDepth: historyCounts.undo,
  };
}
