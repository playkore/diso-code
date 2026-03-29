import { describe, expect, it } from 'vitest';
import {
  createScenarioSnapshot,
  dispatchScenarioEvent,
  getScenarioFlightOverlay,
  getScenarioMissionPanel
} from '../scenarios';
import type { SecretPackagesScenarioState } from '../scenarios/secretPackagesScenario';

/**
 * These tests pin the v1 scenario contract around the first concrete plugin:
 * package placement, travel overlays, pickup progression, and mission-panel
 * projection. They intentionally exercise the public scenario runner rather
 * than importing plugin internals so future scenarios can reuse the same path.
 */
describe('scenario plugins', () => {
  function createSecretPackagesScenario() {
    const snapshot = createScenarioSnapshot({ currentSystem: 'Lave' });
    return {
      snapshot,
      runtimeState: snapshot.runtimeState as SecretPackagesScenarioState
    };
  }

  it('creates 20 unique package records across 20 unique systems', () => {
    const { runtimeState } = createSecretPackagesScenario();
    expect(runtimeState.packages).toHaveLength(20);
    expect(new Set(runtimeState.packages.map((entry) => entry.id)).size).toBe(20);
    expect(new Set(runtimeState.packages.map((entry) => entry.systemName)).size).toBe(20);
  });

  it('returns an empty overlay in systems without a package', () => {
    const { snapshot, runtimeState } = createSecretPackagesScenario();
    const systemWithoutPackage = ['Lave', 'Diso', 'Zaonce', 'Leesti'].find((name) => !runtimeState.packages.some((entry) => entry.systemName === name)) ?? 'Lave';
    const overlay = getScenarioFlightOverlay(snapshot, {
      currentSystem: systemWithoutPackage,
      player: { x: 0, y: 0, angle: 0 },
      station: { x: 0, y: 0 },
      phase: 'PLAYING'
    });
    expect(overlay.entities).toEqual([]);
    expect(overlay.directionHint).toBeUndefined();
  });

  it('shows only a direction hint before the package becomes visible', () => {
    const { snapshot, runtimeState } = createSecretPackagesScenario();
    const target = runtimeState.packages[0];
    const overlay = getScenarioFlightOverlay(snapshot, {
      currentSystem: target.systemName,
      player: { x: 0, y: 0, angle: 0 },
      station: { x: 0, y: 0 },
      phase: 'PLAYING'
    });
    expect(overlay.directionHint?.active).toBe(true);
    expect(overlay.entities).toEqual([]);
  });

  it('reveals the package entity after the player closes to visual range', () => {
    const { snapshot, runtimeState } = createSecretPackagesScenario();
    const target = runtimeState.packages[0];
    const overlay = getScenarioFlightOverlay(snapshot, {
      currentSystem: target.systemName,
      player: {
        x: target.orbitOffsetX - 200,
        y: target.orbitOffsetY,
        angle: 0
      },
      station: { x: 0, y: 0 },
      phase: 'PLAYING'
    });
    expect(overlay.directionHint?.active).toBe(true);
    expect(overlay.entities).toHaveLength(1);
    expect(overlay.entities[0]?.id).toBe(target.id);
  });

  it('collects a package once the player enters the pickup radius and does not double-count repeats', () => {
    const { snapshot, runtimeState } = createSecretPackagesScenario();
    const target = runtimeState.packages[0];

    const moved = dispatchScenarioEvent(
      snapshot,
      {
        type: 'flight:player-moved',
        systemName: target.systemName,
        x: target.orbitOffsetX,
        y: target.orbitOffsetY,
        angle: 0,
        phase: 'PLAYING'
      },
      { currentSystem: 'Lave' }
    );

    const nextState = moved.snapshot.runtimeState as SecretPackagesScenarioState;
    expect(nextState.collectedCount).toBe(1);
    expect(moved.toast?.body).toBe('Collected 1 of 20.');

    const repeated = dispatchScenarioEvent(
      moved.snapshot,
      {
        type: 'flight:player-moved',
        systemName: target.systemName,
        x: target.orbitOffsetX,
        y: target.orbitOffsetY,
        angle: 0,
        phase: 'PLAYING'
      },
      { currentSystem: 'Lave' }
    );
    expect((repeated.snapshot.runtimeState as SecretPackagesScenarioState).collectedCount).toBe(1);
  });

  it('updates the mission panel progress and completion state', () => {
    let snapshot = createScenarioSnapshot({ currentSystem: 'Lave' });
    const initialState = snapshot.runtimeState as SecretPackagesScenarioState;

    for (const entry of initialState.packages) {
      snapshot = dispatchScenarioEvent(
        snapshot,
        {
          type: 'flight:collectible-picked',
          collectibleId: entry.id,
          systemName: entry.systemName
        },
        { currentSystem: 'Lave' }
      ).snapshot;
    }

    const panel = getScenarioMissionPanel(snapshot, { currentSystem: 'Lave' });
    expect(panel?.progressLabel).toBe('20 / 20 collected');
    expect(panel?.status).toBe('completed');
    expect(panel?.summary).toBe('All 20 packages collected');
  });
});
