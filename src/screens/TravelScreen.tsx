import { useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { formatLightYears } from '../utils/distance';

type FlightState = 'READY' | 'PLAYING' | 'JUMPING' | 'ARRIVED' | 'GAMEOVER';

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  fireCooldown: number;
  hp: number;
}

interface Laser {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  isPlayer: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface Star {
  x: number;
  y: number;
  z: number;
}

interface Station {
  x: number;
  y: number;
  radius: number;
  angle: number;
  rotSpeed: number;
}

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  shields: number;
  maxSpeed: number;
  fireCooldown: number;
}

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

export function TravelScreen() {
  const navigate = useNavigate();
  const session = useGameStore((state) => state.travelSession);
  const completeTravel = useGameStore((state) => state.completeTravel);
  const cancelTravel = useGameStore((state) => state.cancelTravel);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const scoreRef = useRef<HTMLSpanElement | null>(null);
  const shieldsRef = useRef<HTMLSpanElement | null>(null);
  const jumpRef = useRef<HTMLSpanElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const jumpButtonRef = useRef<HTMLButtonElement | null>(null);
  const fireButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    const messageNode = messageRef.current;
    const scoreNode = scoreRef.current;
    const shieldsNode = shieldsRef.current;
    const jumpNode = jumpRef.current;
    const knobNode = knobRef.current;
    const jumpButton = jumpButtonRef.current;
    const fireButton = fireButtonRef.current;

    if (!canvas || !viewport || !messageNode || !scoreNode || !shieldsNode || !jumpNode || !knobNode || !jumpButton || !fireButton) {
      return undefined;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }

    let cw = 0;
    let ch = 0;
    const resize = () => {
      cw = canvas.width = viewport.clientWidth;
      ch = canvas.height = viewport.clientHeight;
    };
    resize();

    const input = { turn: 0, thrust: 0, fire: false, jump: false, vectorX: 0, vectorY: 0, vectorStrength: 0 };
    const keys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ' ': false, j: false, J: false };
    let score = 0;
    let flightState: FlightState = 'READY';
    let msgTimer = 0;
    let jumpTimer = 0;
    let animationFrameId = 0;
    let joyActive = false;
    let joyPointerId: number | null = null;
    let joyCenter = { x: 0, y: 0 };
    let lastTimestamp = 0;
    let stationaryTicks = 0;

    const player: Player = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: 12,
      shields: 100,
      maxSpeed: 8,
      fireCooldown: 0
    };

    let stars: Star[] = [];
    let lasers: Laser[] = [];
    let enemies: Enemy[] = [];
    let particles: Particle[] = [];
    let station: Station | null = null;

    const showMessage = (text: string, duration: number) => {
      messageNode.textContent = text;
      msgTimer = duration;
    };

    const updateHud = () => {
      scoreNode.textContent = String(score);
      shieldsNode.textContent = String(Math.max(0, Math.round(player.shields)));
      shieldsNode.style.color = player.shields <= 30 ? '#f55' : '#86ff86';
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
    };

    const spawnExplosion = (x: number, y: number, color: string) => {
      for (let i = 0; i < 20; i += 1) {
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 30 + Math.random() * 20,
          color
        });
      }
    };

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

    const initDestinationSpace = () => {
      initSpace();
      station = {
        x: Math.random() * 1000 - 500 + 500,
        y: Math.random() * 1000 - 500 - 500,
        radius: 80,
        angle: 0,
        rotSpeed: 0.005
      };
      enemies = [];
      lasers = [];
      particles = [];
      score += 250;
      flightState = 'ARRIVED';
      showMessage(`SYSTEM REACHED: ${session.destinationSystem}`, 2200);
      updateHud();
    };

    const startJump = () => {
      if (flightState !== 'READY' && flightState !== 'PLAYING') {
        return;
      }
      flightState = 'JUMPING';
      jumpTimer = 100;
      showMessage(`HYPERSPACE TO ${session.destinationSystem.toUpperCase()}`, 2000);
      player.vx = Math.cos(player.angle) * 5;
      player.vy = Math.sin(player.angle) * 5;
      input.jump = false;
      updateHud();
    };

    const gameOver = () => {
      flightState = 'GAMEOVER';
      spawnExplosion(player.x, player.y, '#fff');
      showMessage('SHIP DESTROYED - PRESS FIRE TO RESET', 99999);
      updateHud();
    };

    const resetPrototype = () => {
      player.x = 0;
      player.y = 0;
      player.vx = 0;
      player.vy = 0;
      player.angle = -Math.PI / 2;
      player.shields = 100;
      player.fireCooldown = 0;
      score = 0;
      initSpace();
      lasers = [];
      enemies = [];
      particles = [];
      station = null;
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
      color = '#0f0',
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

    const drawStation = (target: Station, camX: number, camY: number) => {
      ctx.save();
      ctx.translate(target.x - camX, target.y - camY);
      ctx.rotate(target.angle);
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#0f0';

      const points = Array.from({ length: 8 }, (_, index) => ({
        x: Math.cos((index * Math.PI) / 4) * target.radius,
        y: Math.sin((index * Math.PI) / 4) * target.radius
      }));

      ctx.beginPath();
      ctx.moveTo(points[1].x, points[1].y);
      for (let i = 2; i <= 8; i += 1) {
        ctx.lineTo(points[i % 8].x, points[i % 8].y);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, target.radius - 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
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
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.65)';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(0, 255, 0, 0.25)';
      ctx.fillRect(radarX, radarY, radarWidth, radarHeight);
      ctx.strokeRect(radarX, radarY, radarWidth, radarHeight);

      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(120, 255, 120, 0.45)';
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

      ctx.fillStyle = '#86ff86';
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.fillText('DOCK RADAR', radarX + 12, radarY + 18);

      ctx.save();
      ctx.translate(radarCenterX, radarCenterY);
      ctx.rotate(player.angle + Math.PI / 2);
      ctx.strokeStyle = '#86ff86';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(9, 10);
      ctx.lineTo(0, 5);
      ctx.lineTo(-9, 10);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#86ff86';
      ctx.font = '11px "Courier New", monospace';

      if (station) {
        const dx = station.x - player.x;
        const dy = station.y - player.y;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const radarDistance = Math.min(radarRadius - 8, distance * 0.08);
        const blipX = radarCenterX + Math.cos(angle) * radarDistance;
        const blipY = radarCenterY + Math.sin(angle) * radarDistance;

        ctx.fillStyle = '#ffd35c';
        ctx.beginPath();
        ctx.arc(blipX, blipY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 211, 92, 0.55)';
        ctx.beginPath();
        ctx.moveTo(radarCenterX, radarCenterY);
        ctx.lineTo(blipX, blipY);
        ctx.stroke();

        ctx.fillStyle = '#86ff86';
        ctx.fillText(`DIST ${Math.round(distance)}u`, radarX + 12, radarY + radarHeight - 16);
      } else {
        ctx.fillText('DIST ----', radarX + 12, radarY + radarHeight - 16);
      }

      ctx.restore();
    };

    const draw = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);

      const camX = player.x - cw / 2;
      const camY = player.y - ch / 2;

      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#fff';
      ctx.shadowBlur = 2;
      ctx.shadowColor = '#fff';

      for (const star of stars) {
        const sx = ((star.x - player.x * star.z) % cw + cw) % cw;
        const sy = ((star.y - player.y * star.z) % ch + ch) % ch;

        if (flightState === 'JUMPING') {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - player.vx * star.z * 2, sy - player.vy * star.z * 2);
          ctx.stroke();
        } else {
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
      }

      ctx.shadowBlur = 0;

      if (station) {
        drawStation(station, camX, camY);
      }

      for (const enemy of enemies) {
        drawWireframe(SHAPE_ENEMY, enemy.x - camX, enemy.y - camY, enemy.angle, '#f44');
      }

      ctx.lineWidth = 2;
      for (const laser of lasers) {
        ctx.strokeStyle = laser.isPlayer ? '#0f0' : '#f44';
        ctx.shadowBlur = 5;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(laser.x - camX, laser.y - camY);
        ctx.lineTo(laser.x - camX - laser.vx, laser.y - camY - laser.vy);
        ctx.stroke();
      }

      for (const particle of particles) {
        ctx.fillStyle = particle.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = particle.color;
        ctx.fillRect(particle.x - camX, particle.y - camY, 2, 2);
      }

      if (flightState !== 'GAMEOVER') {
        drawWireframe(SHAPE_PLAYER, cw / 2, ch / 2, player.angle, '#0f0');
      }

      drawMiniMap();

      ctx.shadowBlur = 0;
    };

    const update = (deltaMs: number) => {
      const dt = Math.min(deltaMs, 32) / 16.6667;

      if (flightState === 'GAMEOVER') {
        if (input.fire || keys[' ']) {
          resetPrototype();
        }
        updateHud();
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

      if (flightState === 'READY' || flightState === 'PLAYING' || flightState === 'ARRIVED') {
        if (flightState === 'READY' && (Math.abs(player.vx) > 0.02 || Math.abs(player.vy) > 0.02 || input.thrust > 0 || Math.abs(input.turn) > 0.1)) {
          flightState = 'PLAYING';
        }

        if (joyActive && input.vectorStrength > 0.08) {
          const targetAngle = Math.atan2(input.vectorY, input.vectorX);
          player.angle = targetAngle;
          player.vx += Math.cos(targetAngle) * input.vectorStrength * 0.24 * dt;
          player.vy += Math.sin(targetAngle) * input.vectorStrength * 0.24 * dt;
          particles.push({
            x: player.x - Math.cos(targetAngle) * 15,
            y: player.y - Math.sin(targetAngle) * 15,
            vx: -player.vx * 0.5 + (Math.random() - 0.5),
            vy: -player.vy * 0.5 + (Math.random() - 0.5),
            life: 10,
            color: '#0f0'
          });
        } else {
          player.angle += input.turn * 0.08 * dt;
          if (input.thrust > 0) {
            player.vx += Math.cos(player.angle) * input.thrust * 0.2 * dt;
            player.vy += Math.sin(player.angle) * input.thrust * 0.2 * dt;
            particles.push({
              x: player.x - Math.cos(player.angle) * 15,
              y: player.y - Math.sin(player.angle) * 15,
              vx: -player.vx * 0.5 + (Math.random() - 0.5),
              vy: -player.vy * 0.5 + (Math.random() - 0.5),
              life: 10,
              color: '#0f0'
            });
          }
        }

        player.vx *= 0.99;
        player.vy *= 0.99;
        const speed = Math.hypot(player.vx, player.vy);
        if (speed > player.maxSpeed) {
          player.vx = (player.vx / speed) * player.maxSpeed;
          player.vy = (player.vy / speed) * player.maxSpeed;
        }

        player.x += player.vx * dt;
        player.y += player.vy * dt;

        if (player.fireCooldown > 0) {
          player.fireCooldown -= dt;
        }
        if (input.fire && player.fireCooldown <= 0) {
          lasers.push({
            x: player.x + Math.cos(player.angle) * 15,
            y: player.y + Math.sin(player.angle) * 15,
            vx: player.vx + Math.cos(player.angle) * 15,
            vy: player.vy + Math.sin(player.angle) * 15,
            life: 60,
            isPlayer: true
          });
          player.fireCooldown = 15;
        }

        if ((flightState === 'READY' || flightState === 'PLAYING') && input.jump) {
          startJump();
        }

        if (station && flightState === 'ARRIVED') {
          station.angle += station.rotSpeed * dt;
          const distToStation = Math.hypot(player.x - station.x, player.y - station.y);

          if (distToStation < station.radius + 15) {
            const relativeAngle = Math.atan2(player.y - station.y, player.x - station.x);
            const slotAngle = station.angle + Math.PI / 8;
            const slotOffset = Math.atan2(Math.sin(relativeAngle - slotAngle), Math.cos(relativeAngle - slotAngle));
            const noseAlignment = Math.atan2(Math.sin(player.angle - (slotAngle + Math.PI)), Math.cos(player.angle - (slotAngle + Math.PI)));
            const isInsideSlot = Math.abs(slotOffset) < Math.PI / 7;
            const isFacingHangar = Math.abs(noseAlignment) < Math.PI / 3;

            if (distToStation < station.radius - 5) {
              if (isInsideSlot && isFacingHangar && speed < 3.6) {
                score += 500;
                updateHud();
                showMessage(`DOCKED AT ${session.destinationSystem.toUpperCase()}`, 800);
                completeTravel();
                navigate('/', { replace: true });
                return;
              }

              player.shields -= 20;
              player.vx *= -1.5;
              player.vy *= -1.5;
              spawnExplosion(player.x, player.y, '#0f0');
              if (player.shields <= 0) {
                gameOver();
              } else {
                showMessage('COLLISION WARNING', 1000);
              }
            }
          }
        }
      }

      if (flightState === 'ARRIVED' && Math.hypot(player.vx, player.vy) < 0.05) {
        stationaryTicks += 1;
        if (stationaryTicks > 120) {
          showMessage('USE THRUST TO LINE UP WITH THE STATION SLOT', 1400);
          stationaryTicks = 0;
        }
      } else {
        stationaryTicks = 0;
      }

      if ((flightState === 'PLAYING' || flightState === 'ARRIVED') && Math.random() < 0.005 && enemies.length < 3) {
        enemies.push({
          x: player.x + (Math.random() > 0.5 ? 800 : -800),
          y: player.y + (Math.random() > 0.5 ? 800 : -800),
          vx: 0,
          vy: 0,
          angle: 0,
          fireCooldown: 0,
          hp: 30
        });
      }

      for (let i = enemies.length - 1; i >= 0; i -= 1) {
        const enemy = enemies[i];
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        const targetAngle = Math.atan2(dy, dx);
        const angleDiff = Math.atan2(Math.sin(targetAngle - enemy.angle), Math.cos(targetAngle - enemy.angle));
        enemy.angle += Math.sign(angleDiff) * 0.05 * dt;

        if (dist > 150) {
          enemy.vx += Math.cos(enemy.angle) * 0.1 * dt;
          enemy.vy += Math.sin(enemy.angle) * 0.1 * dt;
        }

        enemy.vx *= 0.98;
        enemy.vy *= 0.98;
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;

        if (enemy.fireCooldown > 0) {
          enemy.fireCooldown -= dt;
        }

        if (dist < 300 && Math.abs(angleDiff) < 0.2 && enemy.fireCooldown <= 0 && flightState !== 'JUMPING') {
          lasers.push({
            x: enemy.x + Math.cos(enemy.angle) * 12,
            y: enemy.y + Math.sin(enemy.angle) * 12,
            vx: enemy.vx + Math.cos(enemy.angle) * 10,
            vy: enemy.vy + Math.sin(enemy.angle) * 10,
            life: 50,
            isPlayer: false
          });
          enemy.fireCooldown = 60;
        }
      }

      for (let i = lasers.length - 1; i >= 0; i -= 1) {
        const laser = lasers[i];
        laser.x += laser.vx * dt;
        laser.y += laser.vy * dt;
        laser.life -= dt;
        let hit = false;

        if (laser.isPlayer) {
          for (let j = enemies.length - 1; j >= 0; j -= 1) {
            const enemy = enemies[j];
            if (Math.hypot(laser.x - enemy.x, laser.y - enemy.y) < 15) {
              enemy.hp -= 10;
              hit = true;
              spawnExplosion(laser.x, laser.y, '#0f0');
              if (enemy.hp <= 0) {
                spawnExplosion(enemy.x, enemy.y, '#f00');
                enemies.splice(j, 1);
                score += 100;
              }
              break;
            }
          }
        } else if (flightState !== 'JUMPING') {
          if (Math.hypot(laser.x - player.x, laser.y - player.y) < player.radius) {
            player.shields -= 10;
            hit = true;
            spawnExplosion(laser.x, laser.y, '#f00');
            if (player.shields <= 0) {
              gameOver();
            }
          }
        }

        if (laser.life <= 0 || hit) {
          lasers.splice(i, 1);
        }
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
        if (particle.life <= 0) {
          particles.splice(i, 1);
        }
      }

      if (flightState === 'JUMPING') {
        player.vx *= 1.05;
        player.vy *= 1.05;
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        jumpTimer -= dt;
        if (jumpTimer <= 0) {
          initDestinationSpace();
        }
      }

      if (msgTimer > 0) {
        msgTimer -= deltaMs;
        if (msgTimer <= 0) {
          messageNode.textContent = '';
        }
      }

      if (!keys[' ']) {
        input.fire = false;
      }
      if (!keys.j && !keys.J) {
        input.jump = false;
      }

      updateHud();
    };

    const loop = (timestamp: number) => {
      const delta = lastTimestamp === 0 ? 16.6667 : timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      update(delta);
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
  }, [cancelTravel, completeTravel, navigate, session]);

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
