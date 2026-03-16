import { useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getSystemByName } from '../domain/galaxyCatalog';
import { applyLegalFloor, getLegalStatus } from '../domain/commander';
import {
  canEnemyLaserFireByCnt,
  canEnemyLaserHitByCnt,
  createMathRandomSource,
  createTravelCombatState,
  enterArrivalSpace,
  setCombatSystemContext,
  stepTravelCombat,
  type CombatProjectile,
  type CombatShipRoles,
  type FlightPhase,
  type TravelCombatState
} from '../domain/travelCombat';
import { hasMissionFlag } from '../domain/missions';
import { useGameStore } from '../store/useGameStore';
import { formatLightYears } from '../utils/distance';

const SHAPE_PLAYER = [
  [15, 0],
  [-10, -10],
  [-5, 0],
  [-10, 10]
] as const;

const SHAPE_ENEMY = [
  [12, 0],
  [-8, -10],
  [-8, 10]
] as const;

const SHAPE_POLICE = [
  [13, 0],
  [0, -12],
  [-10, 0],
  [0, 12]
] as const;

const SHAPE_THARGOID = [
  [12, 0],
  [4, -12],
  [-8, -8],
  [-12, 0],
  [-8, 8],
  [4, 12]
] as const;

const SHAPE_STATION = [
  [45, 0],
  [20, -35],
  [-20, -35],
  [-45, 0],
  [-20, 35],
  [20, 35]
] as const;

const CGA_BLACK = '#000000';
const CGA_GREEN = '#55ff55';
const CGA_RED = '#ff5555';
const CGA_YELLOW = '#ffff55';
const CGA_CYAN = '#55ffff';

function getEnemyColor(roles: CombatShipRoles, missionTag?: string) {
  if (missionTag === 'constrictor') {
    return CGA_CYAN;
  }
  if (missionTag === 'thargoid-plans') {
    return '#ff88ff';
  }
  if (roles.cop) {
    return CGA_CYAN;
  }
  if (roles.innocent || roles.trader) {
    return CGA_YELLOW;
  }
  return CGA_RED;
}

function getEnemyShape(state: TravelCombatState['enemies'][number]) {
  if (state.roles.cop) {
    return SHAPE_POLICE;
  }
  if (state.blueprintId === 'thargoid' || state.blueprintId === 'thargon') {
    return SHAPE_THARGOID;
  }
  return SHAPE_ENEMY;
}

function getProjectileColor(projectile: CombatProjectile) {
  if (projectile.kind === 'missile') {
    return CGA_YELLOW;
  }
  return projectile.owner === 'player' ? CGA_GREEN : CGA_RED;
}

export function TravelScreen() {
  const navigate = useNavigate();
  const session = useGameStore((state) => state.travelSession);
  const commander = useGameStore((state) => state.commander);
  const completeTravel = useGameStore((state) => state.completeTravel);
  const cancelTravel = useGameStore((state) => state.cancelTravel);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const scoreRef = useRef<HTMLSpanElement | null>(null);
  const shieldsRef = useRef<HTMLSpanElement | null>(null);
  const jumpRef = useRef<HTMLSpanElement | null>(null);
  const legalRef = useRef<HTMLSpanElement | null>(null);
  const threatRef = useRef<HTMLSpanElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const jumpButtonRef = useRef<HTMLButtonElement | null>(null);
  const fireButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    const originSystem = getSystemByName(session.originSystem)?.data;
    const destinationSystem = getSystemByName(session.destinationSystem)?.data;
    if (!originSystem || !destinationSystem) {
      return undefined;
    }

    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    const messageNode = messageRef.current;
    const scoreNode = scoreRef.current;
    const shieldsNode = shieldsRef.current;
    const jumpNode = jumpRef.current;
    const legalNode = legalRef.current;
    const threatNode = threatRef.current;
    const knobNode = knobRef.current;
    const jumpButton = jumpButtonRef.current;
    const fireButton = fireButtonRef.current;

    if (!canvas || !viewport || !messageNode || !scoreNode || !shieldsNode || !jumpNode || !legalNode || !threatNode || !knobNode || !jumpButton || !fireButton) {
      return undefined;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }

    const random = createMathRandomSource();
    const combatState = createTravelCombatState(
      {
        legalValue: applyLegalFloor(commander.legalValue, commander.cargo),
        government: originSystem.government,
        techLevel: originSystem.techLevel,
        missionTP: commander.missionTP,
        missionVariant: commander.missionVariant
      },
      random
    );

    let cw = 0;
    let ch = 0;
    const resize = () => {
      cw = canvas.width = viewport.clientWidth;
      ch = canvas.height = viewport.clientHeight;
    };
    resize();

    const input = { turn: 0, thrust: 0, fire: false, jump: false, vectorX: 0, vectorY: 0, vectorStrength: 0 };
    const keys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ' ': false, j: false, J: false };
    let flightState: FlightPhase = 'READY';
    let jumpTimer = 0;
    let animationFrameId = 0;
    let joyActive = false;
    let joyPointerId: number | null = null;
    let joyCenter = { x: 0, y: 0 };
    let lastTimestamp = 0;
    let stationaryTicks = 0;
    let stars: Array<{ x: number; y: number; z: number }> = [];
    let overlayMessage = '';
    let overlayTimer = 0;

    const initSpace = () => {
      stars = [];
      for (let i = 0; i < 150; i += 1) {
        stars.push({
          x: Math.random() * 2000 - 1000,
          y: Math.random() * 2000 - 1000,
          z: Math.random() * 0.8 + 0.2
        });
      }
    };

    const showMessage = (text: string, duration: number) => {
      overlayMessage = text;
      overlayTimer = duration;
      messageNode.textContent = text;
    };

    const updateHud = () => {
      scoreNode.textContent = String(combatState.score);
      shieldsNode.textContent = String(Math.max(0, Math.round(combatState.player.shields)));
      shieldsNode.style.color = combatState.player.shields <= 30 ? CGA_RED : CGA_GREEN;
      jumpNode.textContent =
        flightState === 'READY'
          ? 'READY'
          : flightState === 'PLAYING'
            ? 'CHARGED'
            : flightState === 'JUMPING'
              ? 'ENGAGED'
              : flightState === 'ARRIVED'
                ? 'COMPLETE'
                : 'OFFLINE';
      legalNode.textContent = `${getLegalStatus(combatState.legalValue)} ${combatState.legalValue}`;
      legalNode.style.color = combatState.legalValue >= 50 ? CGA_RED : combatState.legalValue >= 1 ? CGA_YELLOW : CGA_GREEN;
      const hostileCount = combatState.enemies.filter((enemy) => enemy.roles.hostile || enemy.missionTag).length;
      threatNode.textContent = `F${combatState.encounter.activeBlueprintFile} / ${hostileCount}`;
      threatNode.style.color = hostileCount > 0 ? CGA_RED : CGA_GREEN;
    };

    const startJump = () => {
      if (flightState !== 'READY' && flightState !== 'PLAYING') {
        return;
      }
      flightState = 'JUMPING';
      jumpTimer = 100;
      showMessage(`HYPERSPACE TO ${session.destinationSystem.toUpperCase()}`, 2000);
      combatState.player.vx = Math.cos(combatState.player.angle) * 5;
      combatState.player.vy = Math.sin(combatState.player.angle) * 5;
      input.jump = false;
      updateHud();
    };

    const resetPrototype = () => {
      const fresh = createTravelCombatState(
        {
          legalValue: applyLegalFloor(commander.legalValue, commander.cargo),
          government: originSystem.government,
          techLevel: originSystem.techLevel,
          missionTP: commander.missionTP,
          missionVariant: commander.missionVariant
        },
        random
      );
      Object.assign(combatState, fresh);
      setCombatSystemContext(combatState, { government: originSystem.government, techLevel: originSystem.techLevel, witchspace: false }, random);
      initSpace();
      flightState = 'READY';
      showMessage(`ROUTE ${session.originSystem.toUpperCase()} -> ${session.destinationSystem.toUpperCase()}`, 2400);
      updateHud();
    };

    const setKnob = (dx: number, dy: number) => {
      knobNode.style.left = `${dx + 40}px`;
      knobNode.style.top = `${dy + 40}px`;
    };

    const handleJoystick = (clientX: number, clientY: number) => {
      let dx = clientX - joyCenter.x;
      let dy = clientY - joyCenter.y;
      const maxDist = 40;
      const dist = Math.hypot(dx, dy);

      if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
      }

      setKnob(dx, dy);
      input.vectorX = dx / maxDist;
      input.vectorY = dy / maxDist;
      input.vectorStrength = Math.min(1, Math.hypot(input.vectorX, input.vectorY));
      input.turn = input.vectorX;
      input.thrust = input.vectorStrength;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key in keys) {
        keys[event.key] = true;
        if (event.key === ' ' || event.key === 'ArrowUp') {
          event.preventDefault();
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key in keys) {
        keys[event.key] = false;
      }
    };

    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const joystickArea = viewport.querySelector('.travel-screen__joystick') as HTMLDivElement | null;
    const onJoyPointerDown = (event: PointerEvent) => {
      if (!joystickArea) {
        return;
      }
      joyActive = true;
      joyPointerId = event.pointerId;
      const rect = joystickArea.getBoundingClientRect();
      joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      joystickArea.setPointerCapture(event.pointerId);
      handleJoystick(event.clientX, event.clientY);
    };
    const onJoyPointerMove = (event: PointerEvent) => {
      if (!joyActive || joyPointerId !== event.pointerId) {
        return;
      }
      handleJoystick(event.clientX, event.clientY);
    };
    const onJoyPointerUp = (event: PointerEvent) => {
      if (joyPointerId !== event.pointerId) {
        return;
      }
      joyActive = false;
      joyPointerId = null;
      input.turn = 0;
      input.thrust = 0;
      input.vectorX = 0;
      input.vectorY = 0;
      input.vectorStrength = 0;
      setKnob(0, 0);
    };

    joystickArea?.addEventListener('pointerdown', onJoyPointerDown);
    joystickArea?.addEventListener('pointermove', onJoyPointerMove);
    joystickArea?.addEventListener('pointerup', onJoyPointerUp);
    joystickArea?.addEventListener('pointercancel', onJoyPointerUp);

    const bindPressButton = (button: HTMLButtonElement, key: 'fire' | 'jump') => {
      const onPointerDown = () => {
        input[key] = true;
      };
      const onPointerUp = () => {
        input[key] = false;
      };
      button.addEventListener('pointerdown', onPointerDown);
      button.addEventListener('pointerup', onPointerUp);
      button.addEventListener('pointerleave', onPointerUp);
      button.addEventListener('pointercancel', onPointerUp);
      return () => {
        button.removeEventListener('pointerdown', onPointerDown);
        button.removeEventListener('pointerup', onPointerUp);
        button.removeEventListener('pointerleave', onPointerUp);
        button.removeEventListener('pointercancel', onPointerUp);
      };
    };

    const unbindJumpButton = bindPressButton(jumpButton, 'jump');
    const unbindFireButton = bindPressButton(fireButton, 'fire');

    const drawWireframe = (
      points: readonly (readonly [number, number])[],
      x: number,
      y: number,
      angle: number,
      color = CGA_YELLOW,
      scale = 1
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };

    const drawStation = (camX: number, camY: number) => {
      if (!combatState.station) {
        return;
      }

      drawWireframe(SHAPE_STATION, combatState.station.x - camX, combatState.station.y - camY, combatState.station.angle, CGA_YELLOW, 1.8);
      ctx.save();
      ctx.translate(combatState.station.x - camX, combatState.station.y - camY);
      ctx.strokeStyle = combatState.encounter.safeZone ? CGA_CYAN : '#444444';
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, combatState.station.safeZoneRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);
    };

    const drawMiniMap = () => {
      const radarWidth = 156;
      const radarHeight = 156;
      const radarX = cw - radarWidth - 18;
      const radarY = 82;
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

      ctx.save();
      ctx.translate(radarCenterX, radarCenterY);
      ctx.rotate(combatState.player.angle + Math.PI / 2);
      ctx.strokeStyle = CGA_GREEN;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(9, 10);
      ctx.lineTo(0, 5);
      ctx.lineTo(-9, 10);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      if (combatState.station) {
        const dx = combatState.station.x - combatState.player.x;
        const dy = combatState.station.y - combatState.player.y;
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

      for (const enemy of combatState.enemies) {
        const dx = enemy.x - combatState.player.x;
        const dy = enemy.y - combatState.player.y;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const radarDistance = Math.min(radarRadius - 4, distance * 0.06);
        ctx.fillStyle = getEnemyColor(enemy.roles, enemy.missionTag);
        ctx.beginPath();
        ctx.arc(radarCenterX + Math.cos(angle) * radarDistance, radarCenterY + Math.sin(angle) * radarDistance, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    const draw = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);

      const camX = combatState.player.x - cw / 2;
      const camY = combatState.player.y - ch / 2;

      ctx.fillStyle = CGA_YELLOW;
      ctx.strokeStyle = CGA_YELLOW;
      ctx.shadowBlur = 2;
      ctx.shadowColor = CGA_YELLOW;

      for (const star of stars) {
        const sx = ((star.x - combatState.player.x * star.z) % cw + cw) % cw;
        const sy = ((star.y - combatState.player.y * star.z) % ch + ch) % ch;

        if (flightState === 'JUMPING') {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - combatState.player.vx * star.z * 2, sy - combatState.player.vy * star.z * 2);
          ctx.stroke();
        } else {
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
      }

      ctx.shadowBlur = 0;

      drawStation(camX, camY);

      for (const enemy of combatState.enemies) {
        drawWireframe(getEnemyShape(enemy), enemy.x - camX, enemy.y - camY, enemy.angle, getEnemyColor(enemy.roles, enemy.missionTag));
      }

      ctx.lineWidth = 2;
      for (const projectile of combatState.projectiles) {
        ctx.strokeStyle = getProjectileColor(projectile);
        ctx.shadowBlur = 5;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(projectile.x - camX, projectile.y - camY);
        ctx.lineTo(projectile.x - camX - projectile.vx, projectile.y - camY - projectile.vy);
        ctx.stroke();
      }

      for (const particle of combatState.particles) {
        ctx.fillStyle = particle.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = particle.color;
        ctx.fillRect(particle.x - camX, particle.y - camY, 2, 2);
      }

      if (flightState !== 'GAMEOVER') {
        drawWireframe(SHAPE_PLAYER, cw / 2, ch / 2, combatState.player.angle, CGA_YELLOW);
      }

      drawMiniMap();
      ctx.shadowBlur = 0;
    };

    const loop = (timestamp: number) => {
      const deltaMs = lastTimestamp === 0 ? 16.6667 : timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      const dt = Math.min(deltaMs, 32) / 16.6667;

      if (flightState === 'GAMEOVER') {
        if (input.fire || keys[' ']) {
          resetPrototype();
        }
        draw();
        animationFrameId = window.requestAnimationFrame(loop);
        return;
      }

      if (keys.ArrowLeft) {
        input.turn = -1;
      } else if (keys.ArrowRight) {
        input.turn = 1;
      } else if (!joyActive) {
        input.turn = 0;
      }

      if (keys.ArrowUp) {
        input.thrust = 1;
      } else if (!joyActive) {
        input.thrust = 0;
      }

      if (!joyActive) {
        input.vectorX = 0;
        input.vectorY = 0;
        input.vectorStrength = 0;
      }

      input.fire = keys[' '] || input.fire;
      input.jump = keys.j || keys.J || input.jump;

      if (flightState === 'READY' && (Math.abs(combatState.player.vx) > 0.02 || Math.abs(combatState.player.vy) > 0.02 || input.thrust > 0 || Math.abs(input.turn) > 0.1)) {
        flightState = 'PLAYING';
      }

      if (joyActive && input.vectorStrength > 0.08 && flightState !== 'JUMPING') {
        combatState.player.angle = Math.atan2(input.vectorY, input.vectorX);
      }

      const result = stepTravelCombat(
        combatState,
        {
          thrust: flightState === 'JUMPING' ? 0 : input.thrust,
          turn: flightState === 'JUMPING' ? 0 : input.turn,
          fire: flightState === 'JUMPING' ? false : input.fire
        },
        dt,
        flightState,
        commander.cargo,
        random
      );

      if ((flightState === 'READY' || flightState === 'PLAYING') && input.jump) {
        startJump();
      }

      if (flightState === 'JUMPING') {
        combatState.player.vx *= 1.05;
        combatState.player.vy *= 1.05;
        combatState.player.x += combatState.player.vx * dt;
        combatState.player.y += combatState.player.vy * dt;
        jumpTimer -= dt;
        if (jumpTimer <= 0) {
          setCombatSystemContext(combatState, { government: destinationSystem.government, techLevel: destinationSystem.techLevel, witchspace: false }, random);
          enterArrivalSpace(combatState, random);
          flightState = 'ARRIVED';
          showMessage(`SYSTEM REACHED: ${session.destinationSystem.toUpperCase()}`, 1800);
        }
      }

      if (combatState.station && flightState === 'ARRIVED') {
        const distToStation = Math.hypot(combatState.player.x - combatState.station.x, combatState.player.y - combatState.station.y);
        const speed = Math.hypot(combatState.player.vx, combatState.player.vy);

        if (distToStation < combatState.station.radius + 15) {
          const relativeAngle = Math.atan2(combatState.player.y - combatState.station.y, combatState.player.x - combatState.station.x);
          const slotAngle = combatState.station.angle + Math.PI / 8;
          const slotOffset = Math.atan2(Math.sin(relativeAngle - slotAngle), Math.cos(relativeAngle - slotAngle));
          const noseAlignment = Math.atan2(Math.sin(combatState.player.angle - (slotAngle + Math.PI)), Math.cos(combatState.player.angle - (slotAngle + Math.PI)));
          const isInsideSlot = Math.abs(slotOffset) < Math.PI / 7;
          const isFacingHangar = Math.abs(noseAlignment) < Math.PI / 3;

          if (distToStation < combatState.station.radius - 5) {
            if (isInsideSlot && isFacingHangar && speed < 3.6) {
              const missionEvents = [...combatState.missionEvents];
              if (hasMissionFlag(combatState.missionTP, 'thargoidPlansBriefed') && !hasMissionFlag(combatState.missionTP, 'thargoidPlansCompleted')) {
                missionEvents.push({ type: 'combat:thargoid-plans-delivered' });
              }
              completeTravel({
                legalValue: combatState.legalValue,
                tallyDelta: combatState.player.tallyKills,
                missionEvents
              });
              navigate('/', { replace: true });
              return;
            }

            combatState.player.shields -= 20;
            combatState.player.vx *= -1.5;
            combatState.player.vy *= -1.5;
            showMessage('COLLISION WARNING', 1000);
          }
        }
      }

      if (result.playerDestroyed) {
        flightState = 'GAMEOVER';
        showMessage('SHIP DESTROYED - PRESS FIRE TO RESET', 99999);
      }

      if (flightState === 'ARRIVED' && Math.hypot(combatState.player.vx, combatState.player.vy) < 0.05) {
        stationaryTicks += 1;
        if (stationaryTicks > 120) {
          showMessage('USE THRUST TO LINE UP WITH THE STATION SLOT', 1400);
          stationaryTicks = 0;
        }
      } else {
        stationaryTicks = 0;
      }

      if (overlayTimer > 0) {
        overlayTimer -= deltaMs;
        if (overlayTimer <= 0) {
          overlayMessage = '';
        }
      }

      const combatMessage = combatState.messages[0]?.text;
      messageNode.textContent = overlayMessage || combatMessage || '';

      if (!keys[' ']) {
        input.fire = false;
      }
      if (!keys.j && !keys.J) {
        input.jump = false;
      }

      updateHud();
      draw();
      animationFrameId = window.requestAnimationFrame(loop);
    };

    resetPrototype();
    animationFrameId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      joystickArea?.removeEventListener('pointerdown', onJoyPointerDown);
      joystickArea?.removeEventListener('pointermove', onJoyPointerMove);
      joystickArea?.removeEventListener('pointerup', onJoyPointerUp);
      joystickArea?.removeEventListener('pointercancel', onJoyPointerUp);
      unbindJumpButton();
      unbindFireButton();
    };
  }, [cancelTravel, commander, completeTravel, navigate, session]);

  if (!session) {
    return <Navigate to="/star-map" replace />;
  }

  return (
    <section className="travel-screen">
      <div className="travel-screen__viewport" ref={viewportRef}>
        <canvas ref={canvasRef} className="travel-screen__canvas" />

        <div className="travel-screen__hud">
          <div className="travel-screen__hud-line">Route: {session.originSystem} -&gt; {session.destinationSystem}</div>
          <div className="travel-screen__hud-line">
            Fuel: {formatLightYears(session.fuelCost)} <span className="travel-screen__hud-subtle">on arrival jump</span>
          </div>
          <div className="travel-screen__hud-line">Score: <span ref={scoreRef}>0</span></div>
          <div className="travel-screen__hud-line">Shields: <span ref={shieldsRef}>100</span>%</div>
          <div className="travel-screen__hud-line">Jump Drive: <span ref={jumpRef}>READY</span></div>
          <div className="travel-screen__hud-line">Legal: <span ref={legalRef}>clean 0</span></div>
          <div className="travel-screen__hud-line">Threat: <span ref={threatRef}>F- / 0</span></div>
        </div>

        <div ref={messageRef} className="travel-screen__message" />

        <div className="travel-screen__controls">
          <div className="travel-screen__joystick">
            <div ref={knobRef} className="travel-screen__joystick-knob" />
          </div>
          <button ref={jumpButtonRef} type="button" className="travel-screen__button travel-screen__button--jump">
            JUMP
          </button>
          <button ref={fireButtonRef} type="button" className="travel-screen__button travel-screen__button--fire">
            FIRE
          </button>
        </div>

        <div className="travel-screen__help">
          Arrow Keys: Turn/Thrust
          <br />
          Space: Fire
          <br />
          J: Jump
          <br />
          Laser CNT: {canEnemyLaserFireByCnt(-32) ? 'FIRE' : 'HOLD'} / {canEnemyLaserHitByCnt(-35) ? 'HIT' : 'MISS'}
        </div>

        <div className="travel-screen__actions">
          <button
            type="button"
            className="button-danger"
            onClick={() => {
              cancelTravel();
              navigate('/star-map', { replace: true });
            }}
          >
            Abort Flight
          </button>
        </div>
      </div>
    </section>
  );
}
