import { NavLink, Outlet } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import type { AppTab } from '../store/types';

const navItems: Array<{ tab: AppTab; label: string; to: string }> = [
  { tab: 'market', label: 'Market', to: '/' },
  { tab: 'inventory', label: 'Inventory', to: '/inventory' },
  { tab: 'galaxy', label: 'Galaxy', to: '/galaxy' },
  { tab: 'system-data', label: 'System', to: '/system-data' },
  { tab: 'star-map', label: 'Star Map', to: '/star-map' },
  { tab: 'missions', label: 'Missions', to: '/missions' },
  { tab: 'save-load', label: 'Save/Load', to: '/save-load' }
];

export function AppShell() {
  const activeTab = useGameStore((state) => state.ui.activeTab);
  const setActiveTab = useGameStore((state) => state.setActiveTab);
  const universe = useGameStore((state) => state.universe);
  const missionLog = useGameStore((state) => state.missions.missionLog);
  const latestMessage = missionLog[0];

  return (
    <div className="app-shell">
      <header>
        <h1>DISO Commander Console</h1>
        <p>
          Active tab: {activeTab} · Docked at {universe.currentSystem}
        </p>
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
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
