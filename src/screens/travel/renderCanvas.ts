import type { FlightPhase, TravelCombatState } from '../../domain/travelCombat';
import { drawProjectilesAndParticles, drawShips } from './renderers/projectilesRenderer';
import { drawRadar } from './renderers/radarRenderer';
import { drawShips as _unused } from './renderers/projectilesRenderer';
import { CGA_RED, CGA_YELLOW } from './renderers/constants';
import { drawPlayer } from './renderers/shipsRenderer';
import { drawStars, type StarPoint } from './renderers/starsRenderer';
import { drawStation } from './renderers/stationRenderer';

/**
 * Canvas render coordinator.
 *
 * This function does not contain drawing details itself; it establishes render
 * order and camera space, then delegates each layer to a focused renderer.
 *
 * Render order matters:
 * 1. black background
 * 2. parallax stars
 * 3. station and safe-zone ring
 * 4. enemy ships
 * 5. projectiles and particles
 * 6. player ship
 * 7. radar overlay
 */
export function renderCanvas(
  ctx: CanvasRenderingContext2D,
  combatState: TravelCombatState,
  stars: StarPoint[],
  flightState: FlightPhase,
  cw: number,
  ch: number,
  systemLabel: string
) {
  // A short bomb-effect timer drives both screen shake and a red flash. The
  // decay curve is intentionally front-loaded so the blast hits hard, then
  // gets out of the way before it obscures piloting for too long.
  const bombEffectRatio = Math.max(0, Math.min(1, combatState.encounter.bombEffectTimer / 18));
  // ECM is communicated as a separate yellow pulse so the player gets an
  // immediate acknowledgement distinct from the bomb's destructive blast.
  const ecmFlashRatio = Math.max(0, Math.min(1, combatState.encounter.ecmFlashTimer / 10));
  const shakeStrength = bombEffectRatio * bombEffectRatio * 10;
  const shakeX = (Math.random() * 2 - 1) * shakeStrength;
  const shakeY = (Math.random() * 2 - 1) * shakeStrength;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // The travel screen always renders against a pure black background to stay
  // inside the CGA palette used throughout the prototype.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cw, ch);

  // Camera space is centered on the player. World-space renderers receive this
  // offset and convert entity coordinates into screen coordinates.
  const camX = combatState.player.x - cw / 2;
  const camY = combatState.player.y - ch / 2;

  drawStars(ctx, stars, flightState, cw, ch, combatState.player);
  drawStation(ctx, combatState, camX, camY);
  drawShips(ctx, combatState, camX, camY);
  drawProjectilesAndParticles(ctx, combatState, camX, camY);
  if (flightState !== 'GAMEOVER') {
    drawPlayer(ctx, cw, ch, combatState.player.angle);
  }
  drawRadar(ctx, combatState, cw, systemLabel);

  if (bombEffectRatio > 0) {
    ctx.fillStyle = CGA_RED;
    ctx.globalAlpha = 0.12 + bombEffectRatio * 0.26;
    ctx.fillRect(-shakeX, -shakeY, cw, ch);
  }

  if (ecmFlashRatio > 0) {
    ctx.fillStyle = CGA_YELLOW;
    ctx.globalAlpha = 0.1 + ecmFlashRatio * 0.22;
    ctx.fillRect(-shakeX, -shakeY, cw, ch);
  }

  ctx.restore();

  // Reset shadow state so the next frame starts from a clean context.
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}
