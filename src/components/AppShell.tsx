import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cargoUsedTonnes } from '../domain/commander';
import { useGameStore } from '../store/useGameStore';
import type { AppTab } from '../store/types';
import { formatCredits } from '../utils/money';

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="tab-link__icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

const navItems: Array<{ tab: AppTab; label: string; to: string; icon: ReactNode }> = [
  {
    tab: 'market',
    label: 'Market',
    to: '/',
    icon: (
      <NavIcon>
        <path d="M5 9.5h14l-1.2 7.5H6.2z" />
        <path d="M8 9.5V7.8a4 4 0 0 1 8 0v1.7" />
        <path d="M9 13.5h6" />
      </NavIcon>
    )
  },
  {
    tab: 'inventory',
    label: 'Inventory',
    to: '/inventory',
    icon: (
      <NavIcon>
        <rect x="7" y="4.5" width="10" height="15" rx="1.5" />
        <path d="M10 8h4" />
        <path d="M10 12h4" />
        <path d="M10 16h2.5" />
      </NavIcon>
    )
  },
  {
    tab: 'system-data',
    label: 'System',
    to: '/system-data',
    icon: (
      <NavIcon>
        <circle cx="12" cy="12" r="7.5" />
        <path d="M12 10v5" />
        <circle cx="12" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
      </NavIcon>
    )
  },
  {
    tab: 'star-map',
    label: 'Star Map',
    to: '/star-map',
    icon: (
      <NavIcon>
        <circle cx="6.5" cy="8" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="17.5" cy="7" r="1" fill="currentColor" stroke="none" />
        <circle cx="14.5" cy="16.5" r="1.4" fill="currentColor" stroke="none" />
        <path d="M7.6 8.3l8.8-1" />
        <path d="M16.9 7.9l-1.7 7.1" />
      </NavIcon>
    )
  },
  {
    tab: 'missions',
    label: 'Missions',
    to: '/missions',
    icon: (
      <NavIcon>
        <path d="M12 4.5l2.2 4.6l5.1.7l-3.7 3.6l.9 5.1L12 16.1L7.5 18.5l.9-5.1l-3.7-3.6l5.1-.7z" />
      </NavIcon>
    )
  },
  {
    tab: 'save-load',
    label: 'Save/Load',
    to: '/save-load',
    icon: (
      <NavIcon>
        <path d="M6 5h9l3 3v11H6z" />
        <path d="M9 5v5h6V5" />
        <path d="M9 16h6" />
      </NavIcon>
    )
  }
];

export function AppShell() {
  const location = useLocation();
  const setActiveTab = useGameStore((state) => state.setActiveTab);
  const universe = useGameStore((state) => state.universe);
  const commander = useGameStore((state) => state.commander);
  const missionLog = useGameStore((state) => state.missions.missionLog);
  const latestMessage = missionLog[0];
  const cargoUsed = cargoUsedTonnes(commander.cargo);
  const isTravelRoute = location.pathname === '/travel';

  if (isTravelRoute) {
    return (
      <div className="app-shell app-shell--travel">
        <main>
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header>
        <h1>DISO Commander Console</h1>
        <dl className="hud-grid" aria-label="Commander status">
          <div>
            <dt>Credits</dt>
            <dd>{formatCredits(commander.cash)}</dd>
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
            {item.icon}
            <span className="sr-only">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
