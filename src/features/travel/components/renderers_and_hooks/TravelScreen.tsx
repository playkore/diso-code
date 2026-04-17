import { Profiler, useRef, useState, type ProfilerOnRenderCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { shallow } from 'zustand/shallow';
import type { AppTab } from '../../../../shared/store/types';
import { getRouteForTab } from '../../../../appRoutes';
import { useGameStore } from '../../../../store/useGameStore';
import { formatLightYears } from '../../../../shared/utils/distance';
import { TravelConsoleOverlay } from './TravelConsoleOverlay';
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
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleTab, setConsoleTab] = useState<AppTab>('status');

  const travel = useTravelSession(
    { canvasRef, viewportRef },
    screenState.session,
    combatCommander,
    grantCombatCredits,
    completeTravel,
    resetAfterDeath,
    navigate,
    consoleOpen
  );
  const handleRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    travel.recordReactCommit(actualDuration);
  };

  const openConsole = () => {
    travel.resetInput();
    setConsoleOpen(true);
  };

  const closeConsole = () => {
    // Closing the ship console must resume the paused flight route rather than
    // leaving the shell to re-resolve whatever tab was active before travel.
    travel.resetInput();
    navigate('/travel', { replace: true });
    setConsoleOpen(false);
  };

  if (!screenState.session) {
    // A browser refresh during flight restores the last docked autosave instead
    // of trying to rebuild the transient simulation runtime.
    return <Navigate to={getRouteForTab(screenState.activeTab)} replace />;
  }

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
          {consoleOpen ? (
            <TravelConsoleOverlay activeTab={consoleTab} onSelectTab={setConsoleTab} onClose={closeConsole} />
          ) : (
            <TravelControls
              joystickView={travel.joystickView}
              hyperspaceHidden={travel.hyperspaceHidden}
              bomb={travel.bomb}
              ecm={travel.ecm}
              jumpButtonHandlers={travel.jumpButtonHandlers}
              hyperspaceButtonHandlers={travel.hyperspaceButtonHandlers}
              ecmButtonHandlers={travel.ecmButtonHandlers}
              bombButtonHandlers={travel.bombButtonHandlers}
              onOpenConsole={openConsole}
            />
          )}
        </div>
      </section>
    </Profiler>
  );
}
