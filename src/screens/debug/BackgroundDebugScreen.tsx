import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BACKGROUND_OBJECT_DEFINITIONS } from '../travel/background/catalog';
import type { BackgroundObjectDefinition } from '../travel/background/types';
import { CGA_GREEN, CGA_RED, CGA_YELLOW } from '../travel/renderers/constants';
import { drawLineShape } from '../travel/renderers/lineShapeRenderer';

const GRID_SPACING = 24;
const ZOOM_STEP = 0.35;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 8;

/**
 * Debug-only preview screen for authoring and validating line-based scenery.
 *
 * The UI intentionally stays simple: one shared catalog, one selected object,
 * and one preview canvas. That keeps the screen useful as a source-of-truth
 * playground without introducing editor state into the main game store.
 */
export function BackgroundDebugScreen() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedId, setSelectedId] = useState(BACKGROUND_OBJECT_DEFINITIONS[0]?.id ?? '');
  const [zoom, setZoom] = useState(1);
  const selected = useMemo<BackgroundObjectDefinition | undefined>(
    () => BACKGROUND_OBJECT_DEFINITIONS.find((definition) => definition.id === selectedId) ?? BACKGROUND_OBJECT_DEFINITIONS[0],
    [selectedId]
  );

  useEffect(() => {
    // Each object definition has its own intended default size, so switching
    // selection resets the user zoom rather than carrying scale assumptions
    // from one silhouette family into another.
    setZoom(1);
  }, [selectedId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selected) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width || 320));
    const height = Math.max(320, Math.round(rect.height || 320));
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    // The debug preview mirrors the travel screen palette so a shape that
    // reads well here should read the same way once layered into flight.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = CGA_GREEN;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1;
    for (let x = GRID_SPACING; x < width; x += GRID_SPACING) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = GRID_SPACING; y < height; y += GRID_SPACING) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = CGA_RED;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 14, height / 2);
    ctx.lineTo(width / 2 + 14, height / 2);
    ctx.moveTo(width / 2, height / 2 - 14);
    ctx.lineTo(width / 2, height / 2 + 14);
    ctx.stroke();
    ctx.restore();

    const previewScale = selected.defaultScale * zoom;
    drawLineShape(ctx, selected.shape, width / 2, height / 2, selected.defaultAngle, selected.color, previewScale, {
      preserveScreenLineWidth: true,
      lineDash: selected.lineDash
    });

    ctx.save();
    ctx.fillStyle = CGA_YELLOW;
    ctx.font = '14px Courier New, Courier, monospace';
    ctx.fillText(`${selected.kind.toUpperCase()} / SCALE ${(previewScale).toFixed(2)} / ZOOM ${zoom.toFixed(2)}x`, 16, height - 18);
    ctx.restore();
  }, [selected, zoom]);

  return (
    <section className="screen debug-backgrounds">
      <div className="debug-backgrounds__header">
        <div>
          <p className="dialog-kicker">Debug Playground</p>
          <h2>Background Objects</h2>
          <p className="muted">Preview line-based scenery definitions with the same wireframe treatment used by flight rendering.</p>
        </div>
        <Link className="debug-backgrounds__back" to="/save-load">
          Back to Save / Load
        </Link>
      </div>

      <div className="debug-backgrounds__layout">
        <aside className="debug-backgrounds__panel" aria-label="Background object catalog">
          <p className="dialog-kicker">Catalog</p>
          <div className="debug-backgrounds__list">
            {BACKGROUND_OBJECT_DEFINITIONS.map((definition) => (
              <button
                key={definition.id}
                type="button"
                className={`debug-backgrounds__item${definition.id === selected?.id ? ' debug-backgrounds__item--active' : ''}`}
                onClick={() => setSelectedId(definition.id)}
              >
                <span>{definition.label}</span>
                <span className="debug-backgrounds__meta">{definition.kind}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="debug-backgrounds__panel debug-backgrounds__preview" aria-label="Background object preview">
          <div className="debug-backgrounds__preview-header">
            <div>
              <p className="dialog-kicker">Preview</p>
              <h3>{selected?.label ?? 'No object selected'}</h3>
            </div>
            {selected ? (
              <div className="debug-backgrounds__stats">
                <span>ID {selected.id}</span>
                <span>Contours {selected.shape.length}</span>
                <span>Zoom {zoom.toFixed(2)}x</span>
              </div>
            ) : null}
          </div>
          <div className="debug-backgrounds__toolbar">
            <button type="button" onClick={() => setZoom((current) => Math.max(MIN_ZOOM, Number((current - ZOOM_STEP).toFixed(2))))}>
              Zoom -
            </button>
            <button type="button" onClick={() => setZoom(1)}>
              Reset
            </button>
            <button type="button" onClick={() => setZoom((current) => Math.min(MAX_ZOOM, Number((current + ZOOM_STEP).toFixed(2))))}>
              Zoom +
            </button>
          </div>
          <canvas ref={canvasRef} className="debug-backgrounds__canvas" />
          <p className="muted">Green grid marks scale, red crosshair marks the preview anchor, and the object is drawn by the same line renderer and line width used for ship wireframes.</p>
        </section>
      </div>
    </section>
  );
}
