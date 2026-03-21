import type { FlightPhase, TravelCombatState } from '../../domain/travelCombat';
import { drawProjectilesAndParticles, drawShips } from './renderers/projectilesRenderer';
import { drawRadar } from './renderers/radarRenderer';
import { drawShips as _unused } from './renderers/projectilesRenderer';
import { drawPlayer } from './renderers/shipsRenderer';
import { drawStars, type StarPoint } from './renderers/starsRenderer';
import { drawStation } from './renderers/stationRenderer';

export function renderCanvas(
  ctx: CanvasRenderingContext2D,
  combatState: TravelCombatState,
  stars: StarPoint[],
  flightState: FlightPhase,
  cw: number,
  ch: number,
  systemLabel: string
) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cw, ch);

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
  ctx.shadowBlur = 0;
}
