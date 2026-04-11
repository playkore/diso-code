import {
  DoubleSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three';
import { getVisibleRadarContacts, RADAR_SHIP_RANGE, type FlightPhase, type TravelCombatState } from '../../domain/travelCombat';
import { getStationRenderScale } from '../../domain/combat/station/stationGeometry';
import type { LineShape } from './background/types';
import { CGA_BLACK, CGA_GREEN, CGA_RED, CGA_YELLOW, SHAPE_ENEMY, SHAPE_PLAYER, SHAPE_POLICE, SHAPE_THARGOID } from './renderers/constants';
import { getEnemyHealthBarState, getEnemyLaserTrace } from './renderers/projectilesRenderer';
import { getEnemyColor, getProjectileColor } from './renderers/shipsRenderer';
import { createStationObject, selectShipPresenter, type EnemyShipMeshId } from './renderers/shipPresenter';
import { createStars, type StarPoint } from './renderers/starsRenderer';
import { PARALLAX_LAYER_CONFIGS, bucketStarsByParallax, getPerspectiveCameraDistance, getShipPresentationAngles, getWrappedStarScreenPosition } from './renderers/travelSceneMath';

interface TravelSceneRenderArgs {
  combatState: TravelCombatState;
  stars: StarPoint[];
  flightState: FlightPhase;
  systemLabel: string;
  showRadar?: boolean;
  showSafeZoneRing?: boolean;
  showTargetLock: boolean;
  playerBankAngle: number;
  enemyBankAngles: ReadonlyMap<number, number>;
  starfieldAnchor?: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  cameraOverride?: {
    position: { x: number; y: number; z: number };
    lookAt: { x: number; y: number; z: number };
  };
  showcaseOrientationOverride?: {
    roll: number;
    pitch: number;
  } | null;
  playerDeathEffect?: {
    elapsedMs: number;
    showGameOver: boolean;
    showPrompt: boolean;
  } | null;
  showPlayer?: boolean;
  radarInsetTop: number;
  radarInsetRight: number;
}

const CAMERA_FOV_DEGREES = 36;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 5000;
const STARFIELD_Z = -900;
const PLAYER_Z = 28;
const STATION_Z = PLAYER_Z;
const SHIP_Z = 0;
const PROJECTILE_Z = 14;
const PARTICLE_Z = 22;
const PLAYER_DEATH_Z = PLAYER_Z + 2;
function toSceneY(worldY: number) {
  return -worldY;
}

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
          | Array<LineBasicMaterial | LineDashedMaterial | MeshBasicMaterial | PointsMaterial>;
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

function createContourObject(points: readonly (readonly [number, number])[], color: string, closed = false, invertY = true) {
  const geometry = new BufferGeometry();
  // Combat simulation uses the canvas convention where positive Y points
  // downward. Three.js world space uses positive Y upward, so every world-space
  // wireframe point is converted here instead of baking a mirrored camera.
  geometry.setAttribute('position', new Float32BufferAttribute(points.flatMap(([x, y]) => [x, invertY ? -y : y, 0]), 3));
  return closed ? new LineLoop(geometry, createLineMaterial(color)) : new Line(geometry, createLineMaterial(color));
}

function createLineShapeObject(shape: LineShape, color: string, invertY = true) {
  const group = new Group();
  for (const contour of shape) {
    if (contour.points.length === 0) {
      continue;
    }
    group.add(createContourObject(contour.points, color, Boolean(contour.closed), invertY));
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

function createCircleLoop(radius: number, segments: number, color: string, dashed = false, invertY = true) {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  for (let step = 0; step < segments; step += 1) {
    const angle = (step / segments) * Math.PI * 2;
    positions.push(Math.cos(angle) * radius, (invertY ? -1 : 1) * Math.sin(angle) * radius, 0);
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
  geometry.setAttribute('position', new Float32BufferAttribute([startX, toSceneY(startY), z, endX, toSceneY(endY), z], 3));
  return new Line(geometry, createLineMaterial(color));
}

function createQuad(width: number, height: number, color: string, opacity = 1) {
  return new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({
      color,
      side: DoubleSide,
      transparent: opacity < 1,
      opacity,
      // HUD quads are screen-space overlays and should never participate in
      // depth buffering; otherwise coplanar panels can hide later fills even
      // when the renderer computes the right health ratios.
      depthTest: false,
      depthWrite: false
    })
  );
}

function setRenderOrder(object: Object3D, renderOrder: number) {
  object.traverse((node) => {
    node.renderOrder = renderOrder;
  });
  object.renderOrder = renderOrder;
  return object;
}

function rotateOffset(x: number, y: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos
  };
}

/**
 * Enemy health bars use plain overlay primitives rather than texture-backed
 * quads. That keeps the meter logic obvious, avoids texture-orientation edge
 * cases, and matches how the original canvas renderer already decomposes the
 * UI into a frame plus four filled banks.
 */
function createEnemyHealthBarObject(healthBar: NonNullable<ReturnType<typeof getEnemyHealthBarState>>) {
  const bankCount = 4;
  const bankWidth = 4;
  const bankGap = 1;
  const width = bankCount * bankWidth + (bankCount - 1) * bankGap;
  const height = 4;
  const group = new Group();
  const panel = createQuad(width + 2, height + 2, CGA_BLACK);
  panel.position.set(0, 0, 0);
  group.add(panel);
  group.add(
    createLineShapeObject(
      [
        {
          points: [
            [-(width + 1) / 2, -(height + 1) / 2],
            [(width + 1) / 2, -(height + 1) / 2],
            [(width + 1) / 2, (height + 1) / 2],
            [-(width + 1) / 2, (height + 1) / 2]
          ],
          closed: true
        }
      ],
      CGA_YELLOW,
      false
    )
  );

  for (let bankIndex = 0; bankIndex < bankCount; bankIndex += 1) {
    const bankX = -width / 2 + bankIndex * (bankWidth + bankGap) + bankWidth / 2;
    const fillWidth = Math.round(bankWidth * healthBar.bankRatios[bankIndex]);
    const underlay = createQuad(bankWidth, height, CGA_RED);
    underlay.position.set(bankX, 0, 0.01);
    group.add(underlay);
    if (fillWidth > 0) {
      const fill = createQuad(fillWidth, height, healthBar.fillColor);
      // Fill grows from the left edge of each bank so partial segments match
      // the canvas HUD instead of expanding symmetrically around the center.
      fill.position.set(bankX - (bankWidth - fillWidth) / 2, 0, 0.02);
      group.add(fill);
    }
  }

  return group;
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

function getEnemyMeshId(enemy: TravelCombatState['enemies'][number]): EnemyShipMeshId {
  // Renderer geometry now follows the authored ship blueprint instead of
  // collapsing everything into generic hostile/police silhouettes.
  return enemy.blueprintId;
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
  private readonly starCamera = new OrthographicCamera(0, 1, 0, 1, 0.1, 2000);
  private readonly overlayCamera = new OrthographicCamera(0, 1, 0, 1, 0.1, 2000);
  private readonly worldCamera = new PerspectiveCamera(CAMERA_FOV_DEGREES, 1, CAMERA_NEAR, CAMERA_FAR);
  private readonly starGroup = new Group();
  private readonly worldGroup = new Group();
  private readonly overlayGroup = new Group();
  private readonly flashMesh = createQuad(1, 1, CGA_RED, 0);
  private readonly shipPresenter = selectShipPresenter();
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
    // Orthographic HUD scenes use screen-space coordinates at z=0. The camera
    // must sit in front of that plane and look toward it; leaving the default
    // camera transform at the origin makes sprites and quads vanish because
    // they end up on the same plane as the camera itself.
    this.starCamera.position.z = 10;
    this.starCamera.lookAt(0, 0, 0);
    this.overlayCamera.position.z = 10;
    this.overlayCamera.lookAt(0, 0, 0);
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

  renderFrame({
    combatState,
    stars,
    flightState,
    showRadar = true,
    showSafeZoneRing = true,
    showTargetLock,
    playerBankAngle,
    enemyBankAngles,
    starfieldAnchor,
    cameraOverride,
    showcaseOrientationOverride = null,
    playerDeathEffect,
    showPlayer = true,
    radarInsetTop,
    radarInsetRight
  }: TravelSceneRenderArgs) {
    const cameraDistance = getPerspectiveCameraDistance(this.height, CAMERA_FOV_DEGREES);
    const cameraPosition = cameraOverride?.position ?? { x: combatState.player.x, y: combatState.player.y, z: cameraDistance };
    const cameraLookAt = cameraOverride?.lookAt ?? { x: combatState.player.x, y: combatState.player.y, z: 0 };
    this.worldCamera.position.set(cameraPosition.x, toSceneY(cameraPosition.y), cameraPosition.z);
    this.worldCamera.up.set(0, 1, 0);
    this.worldCamera.lookAt(cameraLookAt.x, toSceneY(cameraLookAt.y), cameraLookAt.z);
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

    this.buildStarfield(stars, combatState, flightState, starfieldAnchor);
    this.buildWorld(
      combatState,
      playerBankAngle,
      enemyBankAngles,
      showSafeZoneRing,
      playerDeathEffect ?? null,
      showcaseOrientationOverride,
      showPlayer
    );
    this.buildOverlay(combatState, showTargetLock, showRadar, radarInsetTop, radarInsetRight);
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

  private buildStarfield(
    stars: StarPoint[],
    combatState: TravelCombatState,
    flightState: FlightPhase,
    starfieldAnchor?: TravelSceneRenderArgs['starfieldAnchor']
  ) {
    const starfieldPlayer = starfieldAnchor ?? combatState.player;
    const buckets = bucketStarsByParallax(stars);
    buckets.forEach((bucket, bucketIndex) => {
      if (bucket.length === 0) {
        return;
      }
      const layer = PARALLAX_LAYER_CONFIGS[bucketIndex];
      if (flightState === 'HYPERSPACE' || flightState === 'JUMPING') {
        const positions: number[] = [];
        for (const star of bucket) {
          const screen = getWrappedStarScreenPosition(star, starfieldPlayer, this.width, this.height, layer.parallax);
          positions.push(
            screen.x,
            screen.y,
            STARFIELD_Z,
            screen.x - starfieldPlayer.vx * layer.streakScale * 2.4,
            screen.y - starfieldPlayer.vy * layer.streakScale * 2.4,
            STARFIELD_Z
          );
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
        // Jump and hyperspace streaks are independent star trails, so they
        // must render as disjoint segments instead of one connected polyline.
        this.starGroup.add(new LineSegments(geometry, createLineMaterial(flightState === 'HYPERSPACE' ? CGA_RED : CGA_YELLOW)));
        return;
      }

      const positions: number[] = [];
      for (const star of bucket) {
        const screen = getWrappedStarScreenPosition(star, starfieldPlayer, this.width, this.height, layer.parallax);
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

  private buildWorld(
    combatState: TravelCombatState,
    playerBankAngle: number,
    enemyBankAngles: ReadonlyMap<number, number>,
    showSafeZoneRing: boolean,
    playerDeathEffect: TravelSceneRenderArgs['playerDeathEffect'],
    showcaseOrientationOverride: TravelSceneRenderArgs['showcaseOrientationOverride'],
    showPlayer: boolean
  ) {
    if (combatState.station) {
      const station = createStationObject();
      const stationAnchor = new Group();
      stationAnchor.position.set(combatState.station.x, toSceneY(combatState.station.y), STATION_Z);
      stationAnchor.scale.setScalar(getStationRenderScale(combatState.station));
      // The station spins around the docking axis itself. The outer anchor
      // aims that axis inside the screen plane, and the inner hull then rotates
      // around local X to advance the visible octagon around that axis.
      stationAnchor.rotation.z = -combatState.station.angle;
      station.rotation.x = combatState.station.spinAngle ?? 0;
      stationAnchor.add(station);
      this.worldGroup.add(stationAnchor);

      if (showSafeZoneRing) {
        const safeZone = createCircleLoop(combatState.station.safeZoneRadius, 96, combatState.encounter.safeZone ? CGA_GREEN : CGA_RED, true);
        safeZone.position.set(combatState.station.x, toSceneY(combatState.station.y), STATION_Z - 1);
        this.worldGroup.add(safeZone);
      }
    }

    for (const enemy of combatState.enemies) {
      const ship = this.shipPresenter.enemyGeometryMode === 'mesh'
        ? this.shipPresenter.createEnemyObject?.(getEnemyMeshId(enemy), getEnemyColor(enemy.roles, enemy.missionTag)) ?? new Group()
        : createClosedShape(getEnemyShape(enemy), getEnemyColor(enemy.roles, enemy.missionTag));
      const presentation = getShipPresentationAngles(
        enemy.x - combatState.player.x,
        enemy.y - combatState.player.y,
        this.width,
        this.height
      );
      const enemyAnchor = new Group();
      enemyAnchor.position.set(enemy.x, toSceneY(enemy.y), SHIP_Z);
      // Enemy heading stays on the outer anchor for the same reason as the
      // player ship: bank should lean the hull onto its side without changing
      // the world-space axis that rotates the ship toward the camera.
      enemyAnchor.rotation.z = showcaseOrientationOverride ? 0 : -enemy.angle;
      if (showcaseOrientationOverride) {
        // The showcase uses the ship's local X/Y axes so the hull can spin
        // continuously on its nose axis while also pitching toward and away
        // from the camera.
        ship.rotation.set(showcaseOrientationOverride.roll, showcaseOrientationOverride.pitch, 0);
      } else {
        ship.rotation.set((enemyBankAngles.get(enemy.id) ?? 0) - presentation.pitch, presentation.yaw, 0);
      }
      enemyAnchor.add(ship);
      this.worldGroup.add(enemyAnchor);

      const laserTrace = getEnemyLaserTrace(enemy, combatState);
      if (laserTrace) {
        this.worldGroup.add(createSegmentObject(laserTrace.startX, laserTrace.startY, laserTrace.endX, laserTrace.endY, CGA_RED, PROJECTILE_Z));
      }
    }

    if (playerDeathEffect) {
      this.buildPlayerDeathEffect(combatState, playerDeathEffect);
    } else if (showPlayer) {
      const player = this.shipPresenter.playerGeometryMode === 'mesh'
        ? this.shipPresenter.createPlayerObject?.() ?? new Group()
        : createClosedShape(SHAPE_PLAYER, CGA_YELLOW);
      const playerAnchor = new Group();
      playerAnchor.position.set(combatState.player.x, toSceneY(combatState.player.y), PLAYER_Z);
      // Heading stays on the outer anchor so the ship still rotates around the
      // axis from the player toward the camera. The child ship can then bank
      // around its own forward axis without corrupting the heading axis itself.
      playerAnchor.rotation.z = showcaseOrientationOverride ? 0 : -combatState.player.angle;
      if (showcaseOrientationOverride) {
        player.rotation.set(showcaseOrientationOverride.roll, showcaseOrientationOverride.pitch, 0);
      } else {
        // The hull uses +X as its nose direction, so rolling around local X makes
        // the ship lean onto its left/right side instead of skewing its turn axis.
        player.rotation.set(playerBankAngle, 0, 0);
      }
      playerAnchor.add(player);
      this.worldGroup.add(playerAnchor);
    }

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
      quad.position.set(particle.x, toSceneY(particle.y), PARTICLE_Z);
      this.worldGroup.add(quad);
    }
  }

  private buildOverlay(
    combatState: TravelCombatState,
    showTargetLock: boolean,
    showRadar: boolean,
    radarInsetTop: number,
    radarInsetRight: number
  ) {
    for (const enemy of combatState.enemies) {
      const projected = new Vector3(enemy.x, toSceneY(enemy.y), SHIP_Z).project(this.worldCamera);
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

    if (showRadar) {
      this.buildRadar(combatState, radarInsetTop, radarInsetRight);
    }
  }

  /**
   * The player explosion is deliberately local to the player ship so the rest
   * of the scene can stay intact: enemies, station and projectiles remain on
   * screen while only the Cobra breaks apart into stylized CGA shards.
   */
  private buildPlayerDeathEffect(
    combatState: TravelCombatState,
    playerDeathEffect: NonNullable<TravelSceneRenderArgs['playerDeathEffect']>
  ) {
    const centerX = combatState.player.x;
    const centerY = combatState.player.y;
    const baseAngle = combatState.player.angle;
    const elapsed = playerDeathEffect.elapsedMs;
    // Keep the bright core only for the opening blast. Leaving it on screen for
    // the whole death phase reads as a stuck square rather than an explosion.
    if (elapsed <= 420) {
      const flashRadius = Math.min(30, 8 + elapsed * 0.05);
      const flash = createQuad(flashRadius * 2, flashRadius * 2, elapsed < 180 ? CGA_YELLOW : CGA_RED, elapsed < 180 ? 0.95 : 0.55);
      flash.position.set(centerX, toSceneY(centerY), PLAYER_DEATH_Z);
      this.worldGroup.add(flash);
    }

    const shardAngles = [-1.9, -1.25, -0.65, -0.18, 0.22, 0.75, 1.28, 1.92];
    for (let index = 0; index < shardAngles.length; index += 1) {
      const direction = baseAngle + shardAngles[index];
      const travel = 10 + elapsed * (0.045 + index * 0.004);
      const shardCenter = rotateOffset(travel, (index - 3.5) * 1.8, direction);
      const shardLength = 10 + (index % 3) * 4;
      const shardTilt = direction + index * 0.22;
      const segment = rotateOffset(shardLength * 0.5, 0, shardTilt);
      const color = index % 2 === 0 ? CGA_YELLOW : CGA_RED;
      this.worldGroup.add(
        createSegmentObject(
          centerX + shardCenter.x - segment.x,
          centerY + shardCenter.y - segment.y,
          centerX + shardCenter.x + segment.x,
          centerY + shardCenter.y + segment.y,
          color,
          PLAYER_DEATH_Z
        )
      );
    }

    for (let index = 0; index < 18; index += 1) {
      const angle = baseAngle + (index / 18) * Math.PI * 2;
      const radius = 6 + elapsed * (0.03 + (index % 5) * 0.003);
      const offset = rotateOffset(radius, 0, angle);
      const sparkSize = index % 3 === 0 ? 4 : 2.5;
      const spark = createQuad(sparkSize, sparkSize, index % 4 === 0 ? CGA_RED : CGA_YELLOW, 0.92);
      spark.position.set(centerX + offset.x, toSceneY(centerY + offset.y), PLAYER_DEATH_Z + 0.5);
      this.worldGroup.add(spark);
    }
  }

  private buildEnemyHealthBar(enemy: TravelCombatState['enemies'][number], screenX: number, screenY: number) {
    const healthBar = getEnemyHealthBarState(enemy);
    if (!healthBar) {
      return;
    }

    const bar = createEnemyHealthBarObject(healthBar);
    bar.position.set(Math.round(screenX), Math.round(screenY - 15), 0);
    this.overlayGroup.add(bar);
  }

  private buildTargetIndicator(screenX: number, screenY: number) {
    const arm = 8;
    const gap = 10;
    // Each chevron arm is its own open contour so no diagonal connector is
    // drawn between corners when the target box is assembled.
    this.overlayGroup.add(
      createLineShapeObject(
        [
          {
            points: [
              [screenX - gap - arm, screenY - gap],
              [screenX - gap, screenY - gap],
              [screenX - gap, screenY - gap - arm]
            ],
            closed: false
          },
          {
            points: [
              [screenX + gap + arm, screenY - gap],
              [screenX + gap, screenY - gap],
              [screenX + gap, screenY - gap - arm]
            ],
            closed: false
          },
          {
            points: [
              [screenX - gap - arm, screenY + gap],
              [screenX - gap, screenY + gap],
              [screenX - gap, screenY + gap + arm]
            ],
            closed: false
          },
          {
            points: [
              [screenX + gap + arm, screenY + gap],
              [screenX + gap, screenY + gap],
              [screenX + gap, screenY + gap + arm]
            ],
            closed: false
          }
        ],
        CGA_GREEN,
        false
      )
    );
  }

  private buildRadar(
    combatState: TravelCombatState,
    radarInsetTop: number,
    radarInsetRight: number
  ) {
    const RADAR_PANEL_ORDER = 10;
    const RADAR_GRID_ORDER = 20;
    const RADAR_CONTACT_ORDER = 30;
    const radarSize = Math.min(156, Math.max(120, Math.round(Math.min(this.width, this.height) * 0.24)));
    const radarX = this.width - radarInsetRight - radarSize;
    const radarY = radarInsetTop;
    const radarCenterX = radarX + radarSize / 2;
    const radarCenterY = radarY + radarSize / 2;
    const radarRadius = 48;

    const panel = createQuad(radarSize, radarSize, CGA_BLACK);
    panel.position.set(radarCenterX, radarCenterY, 0);
    this.overlayGroup.add(setRenderOrder(panel, RADAR_PANEL_ORDER));
    this.overlayGroup.add(
      setRenderOrder(createLineShapeObject(
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
        CGA_GREEN,
        false
      ), RADAR_GRID_ORDER)
    );

    const outer = createCircleLoop(radarRadius, 64, CGA_GREEN, false, false);
    outer.position.set(radarCenterX, radarCenterY, 0);
    this.overlayGroup.add(setRenderOrder(outer, RADAR_GRID_ORDER));
    const inner = createCircleLoop(radarRadius * 0.55, 64, CGA_GREEN, false, false);
    inner.position.set(radarCenterX, radarCenterY, 0);
    this.overlayGroup.add(setRenderOrder(inner, RADAR_GRID_ORDER));
    this.overlayGroup.add(setRenderOrder(createSegmentObject(radarCenterX - radarRadius, radarCenterY, radarCenterX + radarRadius, radarCenterY, CGA_GREEN), RADAR_GRID_ORDER));
    this.overlayGroup.add(setRenderOrder(createSegmentObject(radarCenterX, radarCenterY - radarRadius, radarCenterX, radarCenterY + radarRadius, CGA_GREEN), RADAR_GRID_ORDER));

    if (combatState.station) {
      const dx = combatState.station.x - combatState.player.x;
      const dy = combatState.station.y - combatState.player.y;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      // Keep the station marker away from the radar crosshair. When the player
      // is near the station, a purely distance-proportional blip lands almost on
      // the center lines and becomes hard to distinguish from the green grid.
      const radarDistance = Math.min(radarRadius - 8, Math.max(16, distance * 0.08));
      const blipX = radarCenterX + Math.cos(angle) * radarDistance;
      const blipY = radarCenterY + Math.sin(angle) * radarDistance;
      // Station position must read instantly on the scanner even when the
      // launch camera and world scale make the station itself tiny in view, so
      // the radar uses a filled blip with a crosshair instead of a thin loop.
      // The station marker stays intentionally lightweight so it reads as a
      // scanner blip rather than a second HUD widget. A small filled circle is
      // enough once the marker is kept clear of the radar center crosshair.
      const stationBlip = createCircleLoop(3, 16, CGA_YELLOW, false, false);
      stationBlip.position.set(blipX, blipY, 0);
      this.overlayGroup.add(setRenderOrder(stationBlip, RADAR_CONTACT_ORDER));
      const stationCore = createQuad(4, 4, CGA_YELLOW);
      stationCore.position.set(blipX, blipY, 0);
      this.overlayGroup.add(setRenderOrder(stationCore, RADAR_CONTACT_ORDER));
    }

    for (const enemy of getVisibleRadarContacts(combatState, RADAR_SHIP_RANGE)) {
      const dx = enemy.x - combatState.player.x;
      const dy = enemy.y - combatState.player.y;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const radarDistance = Math.min(radarRadius - 4, distance * 0.06);
      const blip = createCircleLoop(2.5, 12, getEnemyColor(enemy.roles, enemy.missionTag), false, false);
      blip.position.set(radarCenterX + Math.cos(angle) * radarDistance, radarCenterY + Math.sin(angle) * radarDistance, 0);
      this.overlayGroup.add(setRenderOrder(blip, RADAR_CONTACT_ORDER));
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
