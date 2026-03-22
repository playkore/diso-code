import { getVisibleRadarContacts, RADAR_SHIP_RANGE, type TravelCombatState } from '../../../domain/travelCombat';
import { CGA_BLACK, CGA_GREEN, CGA_YELLOW } from './constants';
import { getEnemyColor } from './shipsRenderer';

/**
 * Renders the compact docking radar.
 *
 * The radar stays player-centered in world space. Station blips use a slightly
 * larger scale than ships so the player can still track the station while
 * enemies cluster near the origin during close-range combat.
 */
export function drawRadar(
  ctx: CanvasRenderingContext2D,
  state: TravelCombatState,
  cw: number,
  sessionLabel: string
) {
  const radarWidth = 156;
  const radarHeight = 156;
  // The redesigned HUD expects the radar to sit inside the right HUD column
  // above the touch controls, so it stays pinned to the canvas' right edge.
  const radarX = Math.max(18, cw - radarWidth - 16);
  const radarY = 84;
  const radarCenterX = radarX + radarWidth / 2;
  const radarCenterY = radarY + radarHeight / 2;
  const radarRadius = 48;

  ctx.save();
  ctx.fillStyle = CGA_BLACK;
  ctx.strokeStyle = CGA_GREEN;
  ctx.lineWidth = 1;
  ctx.shadowBlur = 12;
  ctx.shadowColor = CGA_GREEN;
  ctx.fillRect(radarX, radarY, radarWidth, radarHeight);
  ctx.strokeRect(radarX, radarY, radarWidth, radarHeight);
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(radarCenterX, radarCenterY, radarRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(radarCenterX, radarCenterY, radarRadius * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(radarCenterX - radarRadius, radarCenterY);
  ctx.lineTo(radarCenterX + radarRadius, radarCenterY);
  ctx.moveTo(radarCenterX, radarCenterY - radarRadius);
  ctx.lineTo(radarCenterX, radarCenterY + radarRadius);
  ctx.stroke();

  ctx.fillStyle = CGA_GREEN;
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillText('DOCK RADAR', radarX + 12, radarY + 18);
  ctx.fillText(sessionLabel.toUpperCase(), radarX + 12, radarY + 34);

  ctx.save();
  ctx.translate(radarCenterX, radarCenterY);
  ctx.rotate(state.player.angle + Math.PI / 2);
  ctx.strokeStyle = CGA_GREEN;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(9, 10);
  ctx.lineTo(0, 5);
  ctx.lineTo(-9, 10);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  if (state.station) {
    const dx = state.station.x - state.player.x;
    const dy = state.station.y - state.player.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const radarDistance = Math.min(radarRadius - 8, distance * 0.08);
    const blipX = radarCenterX + Math.cos(angle) * radarDistance;
    const blipY = radarCenterY + Math.sin(angle) * radarDistance;

    ctx.fillStyle = CGA_YELLOW;
    ctx.beginPath();
    ctx.arc(blipX, blipY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of getVisibleRadarContacts(state, RADAR_SHIP_RANGE)) {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const radarDistance = Math.min(radarRadius - 4, distance * 0.06);
    ctx.fillStyle = getEnemyColor(enemy.roles, enemy.missionTag);
    ctx.beginPath();
    ctx.arc(radarCenterX + Math.cos(angle) * radarDistance, radarCenterY + Math.sin(angle) * radarDistance, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
