import { NavLink, Outlet } from 'react-router-dom';
import { cargoUsedTonnes } from '../domain/commander';
import { useGameStore } from '../store/useGameStore';
import type { AppTab } from '../store/types';

const navItems: Array<{ tab: AppTab; label: string; to: string; icon: string }> = [
  { tab: 'market', label: 'Market', to: '/', icon: '$' },
  { tab: 'inventory', label: 'Inventory', to: '/inventory', icon: '[]' },
  { tab: 'galaxy', label: 'Galaxy', to: '/galaxy', icon: 'O' },
  { tab: 'system-data', label: 'System', to: '/system-data', icon: 'i' },
  { tab: 'star-map', label: 'Star Map', to: '/star-map', icon: '*' },
  { tab: 'missions', label: 'Missions', to: '/missions', icon: '!' },
  { tab: 'save-load', label: 'Save/Load', to: '/save-load', icon: '=' }
];

export function AppShell() {
  const setActiveTab = useGameStore((state) => state.setActiveTab);
  const universe = useGameStore((state) => state.universe);
  const commander = useGameStore((state) => state.commander);
  const missionLog = useGameStore((state) => state.missions.missionLog);
  const latestMessage = missionLog[0];
  const cargoUsed = cargoUsedTonnes(commander.cargo);

  return (
    <div className="app-shell">
      <header>
        <h1>DISO Commander Console</h1>
        <dl className="hud-grid" aria-label="Commander status">
          <div>
            <dt>Credits</dt>
            <dd>{commander.cash} cr</dd>
          </div>
          <div>
            <dt>Cargo</dt>
            <dd>
              {cargoUsed} / {commander.cargoCapacity} t
            </dd>
          </div>
          <div>
            <dt>System</dt>
            <dd>{universe.currentSystem}</dd>
          </div>
        </dl>
        {latestMessage ? (
          <div className="mission-notice" role="status" aria-live="polite">
            <strong>{latestMessage.title}</strong>
            <span>{latestMessage.body}</span>
          </div>
        ) : null}
      </header>

      <main>
        <Outlet />
      </main>

      <nav className="tab-nav" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink
            key={item.tab}
            to={item.to}
            className={({ isActive }) => `tab-link ${isActive ? 'is-active' : ''}`}
            onClick={() => setActiveTab(item.tab)}
            aria-label={item.label}
            title={item.label}
          >
            <span className="tab-link__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="sr-only">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
