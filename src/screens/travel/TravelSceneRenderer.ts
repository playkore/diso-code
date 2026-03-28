import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector3,
  WebGLRenderer
} from 'three';
import { getVisibleRadarContacts, RADAR_SHIP_RANGE, type FlightPhase, type TravelCombatState } from '../../domain/travelCombat';
import type { LineShape } from './background/types';
import { CGA_BLACK, CGA_GREEN, CGA_RED, CGA_YELLOW, SHAPE_ENEMY, SHAPE_PLAYER, SHAPE_POLICE, SHAPE_STATION, SHAPE_THARGOID } from './renderers/constants';
import { getEnemyHealthBarState, getEnemyLaserTrace } from './renderers/projectilesRenderer';
import { getEnemyColor, getProjectileColor } from './renderers/shipsRenderer';
import { selectShipPresenter } from './renderers/shipPresenter';
import { createStars, type StarPoint } from './renderers/starsRenderer';
import { PARALLAX_LAYER_CONFIGS, bucketStarsByParallax, getPerspectiveCameraDistance, getShipPresentationAngles, getWrappedStarScreenPosition } from './renderers/travelSceneMath';

interface TravelSceneRenderArgs {
  combatState: TravelCombatState;
  stars: StarPoint[];
  flightState: FlightPhase;
  systemLabel: string;
  showTargetLock: boolean;
  radarInsetTop: number;
  radarInsetRight: number;
}

const CAMERA_FOV_DEGREES = 36;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 5000;
const STARFIELD_Z = -900;
const STATION_Z = -20;
const SHIP_Z = 0;
const PROJECTILE_Z = 14;
const PARTICLE_Z = 22;
const PLAYER_Z = 28;

function createLineMaterial(color: string, dashed = false) {
  return dashed
    ? new LineDashedMaterial({
        color,
        dashSize: 6,
        gapSize: 8
      })
    : new LineBasicMaterial({ color });
}

function disposeObject(object: Object3D) {
  object.traverse((node) => {
    const geometry = (node as { geometry?: BufferGeometry }).geometry;
    if (geometry) {
      geometry.dispose();
    }
    const material = (
      node as {
        material?:
          | LineBasicMaterial
          | LineDashedMaterial
          | MeshBasicMaterial
          | PointsMaterial
          | SpriteMaterial
          | Array<LineBasicMaterial | LineDashedMaterial | MeshBasicMaterial | PointsMaterial | SpriteMaterial>;
      }
    ).material;
    if (Array.isArray(material)) {
      for (const entry of material) {
        if ('map' in entry && entry.map) {
          entry.map.dispose();
        }
        entry.dispose();
      }
    } else if (material) {
      if ('map' in material && material.map) {
        material.map.dispose();
      }
      material.dispose();
    }
  });
}

function clearGroup(group: Group) {
  for (let index = group.children.length - 1; index >= 0; index -= 1) {
    const child = group.children[index];
    group.remove(child);
    disposeObject(child);
  }
}

function createContourObject(points: readonly (readonly [number, number])[], color: string, closed = false) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points.flatMap(([x, y]) => [x, y, 0]), 3));
  return closed ? new LineLoop(geometry, createLineMaterial(color)) : new Line(geometry, createLineMaterial(color));
}

function createLineShapeObject(shape: LineShape, color: string) {
  const group = new Group();
  for (const contour of shape) {
    if (contour.points.length === 0) {
      continue;
    }
    group.add(createContourObject(contour.points, color, Boolean(contour.closed)));
  }
  return group;
}

function createClosedShape(points: readonly (readonly [number, number])[], color: string) {
  return createLineShapeObject(
    [
      {
        points: points.map(([x, y]) => [x, y] as [number, number]),
        closed: true
      }
    ],
    color
  );
}

function createCircleLoop(radius: number, segments: number, color: string, dashed = false) {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  for (let step = 0; step < segments; step += 1) {
    const angle = (step / segments) * Math.PI * 2;
    positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const circle = new LineLoop(geometry, createLineMaterial(color, dashed));
  if (dashed) {
    circle.computeLineDistances();
  }
  return circle;
}

function createSegmentObject(startX: number, startY: number, endX: number, endY: number, color: string, z = 0) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([startX, startY, z, endX, endY, z], 3));
  return new Line(geometry, createLineMaterial(color));
}

function createQuad(width: number, height: number, color: string, opacity = 1) {
  return new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthTest: false
    })
  );
}

function createTextSprite(text: string, color: string) {
  const canvas = document.createElement('canvas');
  const bootstrap = canvas.getContext('2d');
  if (!bootstrap) {
    return null;
  }
  bootstrap.font = 'bold 24px "Courier New", monospace';
  const metrics = bootstrap.measureText(text);
  canvas.width = Math.max(2, Math.ceil(metrics.width) + 12);
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.font = 'bold 24px "Courier New", monospace';
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.fillText(text, 6, 4);
  const texture = new Texture(canvas);
  texture.needsUpdate = true;
  const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.center.set(0, 1);
  sprite.scale.set(canvas.width, canvas.height, 1);
  return sprite;
}

function getEnemyShape(enemy: TravelCombatState['enemies'][number]) {
  if (enemy.roles.cop) {
    return SHAPE_POLICE;
  }
  if (enemy.blueprintId === 'thargoid' || enemy.blueprintId === 'thargon') {
    return SHAPE_THARGOID;
  }
  return SHAPE_ENEMY;
}

/**
 * The WebGL travel renderer keeps the combat simulation completely outside the
 * scene graph. Its only job is to translate the current mutable combat state
 * into Three.js objects while preserving the established render order and CGA
 * color language from the 2D canvas prototype.
 */
export class TravelSceneRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly starScene = new Scene();
  private readonly worldScene = new Scene();
  private readonly overlayScene = new Scene();
  private readonly starCamera = new OrthographicCamera(0, 1, 0, 1, -1000, 1000);
  private readonly overlayCamera = new OrthographicCamera(0, 1, 0, 1, -1000, 1000);
  private readonly worldCamera = new PerspectiveCamera(CAMERA_FOV_DEGREES, 1, CAMERA_NEAR, CAMERA_FAR);
  private readonly starGroup = new Group();
  private readonly worldGroup = new Group();
  private readonly overlayGroup = new Group();
  private readonly flashMesh = createQuad(1, 1, CGA_RED, 0);
  private readonly shipPresenter = selectShipPresenter('flat-wireframe');
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false
    });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(new Color(CGA_BLACK), 1);
    this.starScene.add(this.starGroup);
    this.worldScene.add(this.worldGroup);
    this.overlayScene.add(this.overlayGroup);
    this.overlayGroup.add(this.flashMesh);
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.width, this.height, false);
    this.starCamera.left = 0;
    this.starCamera.right = this.width;
    this.starCamera.top = 0;
    this.starCamera.bottom = this.height;
    this.starCamera.updateProjectionMatrix();
    this.overlayCamera.left = 0;
    this.overlayCamera.right = this.width;
    this.overlayCamera.top = 0;
    this.overlayCamera.bottom = this.height;
    this.overlayCamera.updateProjectionMatrix();
    this.worldCamera.aspect = this.width / this.height;
    this.worldCamera.updateProjectionMatrix();
    this.flashMesh.geometry.dispose();
    this.flashMesh.geometry = new PlaneGeometry(this.width, this.height);
    this.flashMesh.position.set(this.width / 2, this.height / 2, 0);
  }

  renderFrame({ combatState, stars, flightState, systemLabel, showTargetLock, radarInsetTop, radarInsetRight }: TravelSceneRenderArgs) {
    const cameraDistance = getPerspectiveCameraDistance(this.height, CAMERA_FOV_DEGREES);
    this.worldCamera.position.set(combatState.player.x, combatState.player.y, cameraDistance);
    this.worldCamera.up.set(0, -1, 0);
    this.worldCamera.lookAt(combatState.player.x, combatState.player.y, 0);
    this.worldCamera.updateProjectionMatrix();

    clearGroup(this.starGroup);
    clearGroup(this.worldGroup);
    for (let index = this.overlayGroup.children.length - 1; index >= 0; index -= 1) {
      const child = this.overlayGroup.children[index];
      if (child === this.flashMesh) {
        continue;
      }
      this.overlayGroup.remove(child);
      disposeObject(child);
    }

    this.buildStarfield(stars, combatState, flightState);
    this.buildWorld(combatState);
    this.buildOverlay(combatState, systemLabel, showTargetLock, radarInsetTop, radarInsetRight);
    this.updateFlash(combatState);

    this.renderer.clear(true, true, true);
    this.renderer.render(this.starScene, this.starCamera);
    this.renderer.clearDepth();
    this.renderer.render(this.worldScene, this.worldCamera);
    this.renderer.clearDepth();
    this.renderer.render(this.overlayScene, this.overlayCamera);
  }

  dispose() {
    clearGroup(this.starGroup);
    clearGroup(this.worldGroup);
    clearGroup(this.overlayGroup);
    this.renderer.dispose();
  }

  private buildStarfield(stars: StarPoint[], combatState: TravelCombatState, flightState: FlightPhase) {
    const buckets = bucketStarsByParallax(stars);
    buckets.forEach((bucket, bucketIndex) => {
      if (bucket.length === 0) {
        return;
      }
      const layer = PARALLAX_LAYER_CONFIGS[bucketIndex];
      if (flightState === 'HYPERSPACE' || flightState === 'JUMPING') {
        const positions: number[] = [];
        for (const star of bucket) {
          const screen = getWrappedStarScreenPosition(star, combatState.player, this.width, this.height, layer.parallax);
          positions.push(
            screen.x,
            screen.y,
            STARFIELD_Z,
            screen.x - combatState.player.vx * layer.streakScale * 2.4,
            screen.y - combatState.player.vy * layer.streakScale * 2.4,
            STARFIELD_Z
          );
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
        this.starGroup.add(new Line(geometry, createLineMaterial(flightState === 'HYPERSPACE' ? CGA_RED : CGA_YELLOW)));
        return;
      }

      const positions: number[] = [];
      for (const star of bucket) {
        const screen = getWrappedStarScreenPosition(star, combatState.player, this.width, this.height, layer.parallax);
        positions.push(screen.x, screen.y, STARFIELD_Z);
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      this.starGroup.add(
        new Points(
          geometry,
          new PointsMaterial({
            color: CGA_YELLOW,
            size: 1.5 + bucketIndex * 0.35,
            sizeAttenuation: false
          })
        )
      );
    });
  }

  private buildWorld(combatState: TravelCombatState) {
    if (combatState.station) {
      const station = createClosedShape(SHAPE_STATION, CGA_YELLOW);
      station.position.set(combatState.station.x, combatState.station.y, STATION_Z);
      station.scale.setScalar(1.8);
      station.rotation.z = combatState.station.angle;
      this.worldGroup.add(station);

      const safeZone = createCircleLoop(combatState.station.safeZoneRadius, 96, combatState.encounter.safeZone ? CGA_GREEN : CGA_RED, true);
      safeZone.position.set(combatState.station.x, combatState.station.y, STATION_Z - 1);
      this.worldGroup.add(safeZone);
    }

    for (const enemy of combatState.enemies) {
      const ship = this.shipPresenter.geometryMode === 'line-shape'
        ? createClosedShape(getEnemyShape(enemy), getEnemyColor(enemy.roles, enemy.missionTag))
        : new Group();
      const presentation = getShipPresentationAngles(
        enemy.x - combatState.player.x,
        enemy.y - combatState.player.y,
        this.width,
        this.height
      );
      ship.position.set(enemy.x, enemy.y, SHIP_Z);
      ship.rotation.set(presentation.pitch, presentation.yaw, enemy.angle);
      this.worldGroup.add(ship);

      const laserTrace = getEnemyLaserTrace(enemy, combatState);
      if (laserTrace) {
        this.worldGroup.add(createSegmentObject(laserTrace.startX, laserTrace.startY, laserTrace.endX, laserTrace.endY, CGA_RED, PROJECTILE_Z));
      }
    }

    const player = createClosedShape(SHAPE_PLAYER, CGA_YELLOW);
    player.position.set(combatState.player.x, combatState.player.y, PLAYER_Z);
    player.rotation.z = combatState.player.angle;
    this.worldGroup.add(player);

    for (const projectile of combatState.projectiles) {
      this.worldGroup.add(
        createSegmentObject(
          projectile.x,
          projectile.y,
          projectile.x - projectile.vx,
          projectile.y - projectile.vy,
          getProjectileColor(projectile),
          PROJECTILE_Z
        )
      );
    }

    for (const particle of combatState.particles) {
      const lifeRatio = particle.maxLife > 0 ? Math.max(0, Math.min(1, particle.life / particle.maxLife)) : 0;
      const ageRatio = 1 - lifeRatio;
      const size = particle.color === CGA_GREEN ? particle.size + ageRatio * 2.8 : particle.size + ageRatio * 1.8;
      const quad = createQuad(size, size, particle.color);
      quad.position.set(particle.x, particle.y, PARTICLE_Z);
      this.worldGroup.add(quad);
    }
  }

  private buildOverlay(
    combatState: TravelCombatState,
    systemLabel: string,
    showTargetLock: boolean,
    radarInsetTop: number,
    radarInsetRight: number
  ) {
    for (const enemy of combatState.enemies) {
      const projected = new Vector3(enemy.x, enemy.y, SHIP_Z).project(this.worldCamera);
      if (projected.z < -1 || projected.z > 1) {
        continue;
      }
      const screenX = (projected.x * 0.5 + 0.5) * this.width;
      const screenY = (projected.y * -0.5 + 0.5) * this.height;
      this.buildEnemyHealthBar(enemy, screenX, screenY);
      if (showTargetLock && combatState.playerTargetLock?.enemyId === enemy.id) {
        this.buildTargetIndicator(screenX, screenY);
      }
    }

    this.buildRadar(combatState, systemLabel, radarInsetTop, radarInsetRight);
  }

  private buildEnemyHealthBar(enemy: TravelCombatState['enemies'][number], screenX: number, screenY: number) {
    const healthBar = getEnemyHealthBarState(enemy);
    if (!healthBar) {
      return;
    }

    const bankCount = 4;
    const bankWidth = 4;
    const bankGap = 1;
    const width = bankCount * bankWidth + (bankCount - 1) * bankGap;
    const height = 4;
    const x = Math.round(screenX - width / 2);
    const y = Math.round(screenY - 18);

    const frame = createQuad(width + 2, height + 2, CGA_BLACK);
    frame.position.set(x + width / 2, y + height / 2, 0);
    this.overlayGroup.add(frame);
    this.overlayGroup.add(
      createLineShapeObject(
        [
          {
            points: [
              [x - 0.5, y - 0.5],
              [x + width + 0.5, y - 0.5],
              [x + width + 0.5, y + height + 0.5],
              [x - 0.5, y + height + 0.5]
            ],
            closed: true
          }
        ],
        CGA_YELLOW
      )
    );

    for (let bankIndex = 0; bankIndex < bankCount; bankIndex += 1) {
      const bankX = x + bankIndex * (bankWidth + bankGap);
      const underlay = createQuad(bankWidth, height, CGA_RED);
      underlay.position.set(bankX + bankWidth / 2, y + height / 2, 0);
      this.overlayGroup.add(underlay);

      const fillWidth = Math.round(bankWidth * healthBar.bankRatios[bankIndex]);
      if (fillWidth > 0) {
        const fill = createQuad(fillWidth, height, healthBar.fillColor);
        fill.position.set(bankX + fillWidth / 2, y + height / 2, 0);
        this.overlayGroup.add(fill);
      }
    }
  }

  private buildTargetIndicator(screenX: number, screenY: number) {
    const arm = 8;
    const gap = 10;
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        [
          screenX - gap - arm, screenY - gap, 0,
          screenX - gap, screenY - gap, 0,
          screenX - gap, screenY - gap, 0,
          screenX - gap, screenY - gap - arm, 0,
          screenX + gap + arm, screenY - gap, 0,
          screenX + gap, screenY - gap, 0,
          screenX + gap, screenY - gap, 0,
          screenX + gap, screenY - gap - arm, 0,
          screenX - gap - arm, screenY + gap, 0,
          screenX - gap, screenY + gap, 0,
          screenX - gap, screenY + gap, 0,
          screenX - gap, screenY + gap + arm, 0,
          screenX + gap + arm, screenY + gap, 0,
          screenX + gap, screenY + gap, 0,
          screenX + gap, screenY + gap, 0,
          screenX + gap, screenY + gap + arm, 0
        ],
        3
      )
    );
    this.overlayGroup.add(new Line(geometry, createLineMaterial(CGA_GREEN)));
  }

  private buildRadar(combatState: TravelCombatState, systemLabel: string, radarInsetTop: number, radarInsetRight: number) {
    const radarSize = Math.min(156, Math.max(120, Math.round(Math.min(this.width, this.height) * 0.24)));
    const radarX = this.width - radarInsetRight - radarSize;
    const radarY = radarInsetTop;
    const radarCenterX = radarX + radarSize / 2;
    const radarCenterY = radarY + radarSize / 2;
    const radarRadius = 48;

    const panel = createQuad(radarSize, radarSize, CGA_BLACK);
    panel.position.set(radarCenterX, radarCenterY, 0);
    this.overlayGroup.add(panel);
    this.overlayGroup.add(
      createLineShapeObject(
        [
          {
            points: [
              [radarX, radarY],
              [radarX + radarSize, radarY],
              [radarX + radarSize, radarY + radarSize],
              [radarX, radarY + radarSize]
            ],
            closed: true
          }
        ],
        CGA_GREEN
      )
    );

    const outer = createCircleLoop(radarRadius, 64, CGA_GREEN);
    outer.position.set(radarCenterX, radarCenterY, 0);
    this.overlayGroup.add(outer);
    const inner = createCircleLoop(radarRadius * 0.55, 64, CGA_GREEN);
    inner.position.set(radarCenterX, radarCenterY, 0);
    this.overlayGroup.add(inner);
    this.overlayGroup.add(createSegmentObject(radarCenterX - radarRadius, radarCenterY, radarCenterX + radarRadius, radarCenterY, CGA_GREEN));
    this.overlayGroup.add(createSegmentObject(radarCenterX, radarCenterY - radarRadius, radarCenterX, radarCenterY + radarRadius, CGA_GREEN));

    const titleSprite = createTextSprite('DOCK RADAR', CGA_GREEN);
    if (titleSprite) {
      titleSprite.position.set(radarX + 12, radarY + 18, 0);
      this.overlayGroup.add(titleSprite);
    }
    const labelSprite = createTextSprite(systemLabel.toUpperCase(), CGA_GREEN);
    if (labelSprite) {
      labelSprite.position.set(radarX + 12, radarY + 34, 0);
      this.overlayGroup.add(labelSprite);
    }

    if (combatState.station) {
      const dx = combatState.station.x - combatState.player.x;
      const dy = combatState.station.y - combatState.player.y;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const radarDistance = Math.min(radarRadius - 8, distance * 0.08);
      const blip = createCircleLoop(4, 18, CGA_YELLOW);
      blip.position.set(radarCenterX + Math.cos(angle) * radarDistance, radarCenterY + Math.sin(angle) * radarDistance, 0);
      this.overlayGroup.add(blip);
    }

    for (const enemy of getVisibleRadarContacts(combatState, RADAR_SHIP_RANGE)) {
      const dx = enemy.x - combatState.player.x;
      const dy = enemy.y - combatState.player.y;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const radarDistance = Math.min(radarRadius - 4, distance * 0.06);
      const blip = createCircleLoop(2.5, 12, getEnemyColor(enemy.roles, enemy.missionTag));
      blip.position.set(radarCenterX + Math.cos(angle) * radarDistance, radarCenterY + Math.sin(angle) * radarDistance, 0);
      this.overlayGroup.add(blip);
    }
  }

  private updateFlash(combatState: TravelCombatState) {
    const bombEffectRatio = Math.max(0, Math.min(1, combatState.encounter.bombEffectTimer / 18));
    const ecmFlashRatio = Math.max(0, Math.min(1, combatState.encounter.ecmFlashTimer / 10));
    const material = this.flashMesh.material as MeshBasicMaterial;

    if (bombEffectRatio > 0) {
      material.color = new Color(CGA_RED);
      material.opacity = 0.12 + bombEffectRatio * 0.26;
      material.transparent = true;
      this.flashMesh.visible = true;
      return;
    }
    if (ecmFlashRatio > 0) {
      material.color = new Color(CGA_YELLOW);
      material.opacity = 0.1 + ecmFlashRatio * 0.22;
      material.transparent = true;
      this.flashMesh.visible = true;
      return;
    }

    material.opacity = 0;
    this.flashMesh.visible = false;
  }
}

export { createStars };
