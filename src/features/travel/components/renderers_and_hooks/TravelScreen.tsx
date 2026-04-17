import { Profiler, useRef, type ProfilerOnRenderCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { shallow } from 'zustand/shallow';
import { getRouteForTab } from '../../../../appRoutes';
import { canEnemyLaserFireByCnt, canEnemyLaserHitByCnt } from '../../domain/travelCombat';
import { useGameStore } from '../../../../store/useGameStore';
import { formatLightYears } from '../../../../shared/utils/distance';
import { TravelControls } from './TravelControls';
import { TravelHudPanel } from './TravelHudPanel';
import { TravelOverlays } from './TravelOverlays';
import { useTravelSession } from './useTravelSession';

export function TravelScreen() {
  const navigate = useNavigate();
  const screenState = useGameStore(
    (state) => ({
      session: state.travelSession,
      commanderCash: state.commander.cash,
      commanderFuel: state.commander.fuel,
      showTravelPerfOverlay: state.ui.showTravelPerfOverlay,
      activeTab: state.ui.activeTab
    }),
    shallow
  );
  const combatCommander = useGameStore(
    (state) => ({
      cargo: state.commander.cargo,
      legalValue: state.commander.legalValue,
      galaxyIndex: state.universe.galaxyIndex,
      level: state.commander.level,
      xp: state.commander.xp,
      hp: state.commander.hp,
      maxHp: state.commander.maxHp,
      attack: state.commander.attack,
      laserMounts: state.commander.laserMounts,
      installedEquipment: state.commander.installedEquipment,
      missilesInstalled: state.commander.missilesInstalled
    }),
    shallow
  );
  const grantCombatCredits = useGameStore((state) => state.grantCombatCredits);
  const completeTravel = useGameStore((state) => state.completeTravel);
  const resetAfterDeath = useGameStore((state) => state.resetAfterDeath);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const travel = useTravelSession(
    { canvasRef, viewportRef },
    screenState.session,
    combatCommander,
    grantCombatCredits,
    completeTravel,
    resetAfterDeath,
    navigate
  );
  const handleRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    travel.recordReactCommit(actualDuration);
  };

  if (!screenState.session) {
    // A browser refresh during flight restores the last docked autosave instead
    // of trying to rebuild the transient simulation runtime.
    return <Navigate to={getRouteForTab(screenState.activeTab)} replace />;
  }

  // Undocking reuses the travel screen with a zero-cost local-space session.
  // In that mode there is no selected hyperspace destination, so the HUD should
  // present the route as absent and fuel as the ship's remaining reserve.
  const hasHyperspaceRoute = screenState.session.fuelUnits > 0 && screenState.session.originSystem !== screenState.session.destinationSystem;
  const routeLabel = hasHyperspaceRoute ? `${screenState.session.originSystem} -> ${screenState.session.destinationSystem}` : 'none';
  const fuelLabel = hasHyperspaceRoute ? formatLightYears(screenState.session.fuelCost) : formatLightYears(screenState.commanderFuel);

  return (
    <Profiler id="travel-screen" onRender={handleRender}>
      <section className="travel-screen">
        <div className="travel-screen__viewport" ref={viewportRef} {...travel.viewportHandlers}>
          <canvas ref={canvasRef} className="travel-screen__canvas" />
          <TravelHudPanel routeLabel={routeLabel} fuelLabel={fuelLabel} commanderCash={screenState.commanderCash} hud={travel.hud} />
          <TravelOverlays
            perf={travel.perf}
            showPerfOverlay={screenState.showTravelPerfOverlay}
            message={travel.message}
            gameOverVisible={travel.gameOverOverlay.visible}
          />
          <TravelControls
            joystickView={travel.joystickView}
            hyperspaceHidden={travel.hyperspaceHidden}
            hudLasersActive={travel.hud.lasersActive}
            autoDock={travel.autoDock}
            bomb={travel.bomb}
            ecm={travel.ecm}
            jumpButtonHandlers={travel.jumpButtonHandlers}
            toggleLasersButtonHandlers={travel.toggleLasersButtonHandlers}
            hyperspaceButtonHandlers={travel.hyperspaceButtonHandlers}
            ecmButtonHandlers={travel.ecmButtonHandlers}
            bombButtonHandlers={travel.bombButtonHandlers}
            dockButtonHandlers={travel.dockButtonHandlers}
          />

          <div className="travel-screen__help">
            Space Laser On/Off / J Jump / H Hyper / CNT {canEnemyLaserFireByCnt(-32) ? 'FIRE' : 'HOLD'} {canEnemyLaserHitByCnt(-35) ? 'HIT' : 'MISS'}
          </div>
        </div>
      </section>
    </Profiler>
  );
}
