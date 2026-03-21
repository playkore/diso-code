import type { FlightPhase, TravelCombatState } from '../../domain/travelCombat';
import { drawProjectilesAndParticles, drawShips } from './renderers/projectilesRenderer';
import { drawRadar } from './renderers/radarRenderer';
import { drawShips as _unused } from './renderers/projectilesRenderer';
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

  // Reset shadow state so the next frame starts from a clean context.
  ctx.shadowBlur = 0;
}
