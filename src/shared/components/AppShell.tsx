import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { TAB_ROUTE_MAP } from '../../appRoutes';
import { useGameStore } from '../../store/useGameStore';
import type { AppTab } from '../store/types';
import { formatCredits } from '../utils/money';
import { StartScreenGate } from './StartScreenGate';
import { StartScreenLoader } from './StartScreenLoader';

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="tab-link__icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

function UtilityIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="app-shell__utility-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

function MenuIcon() {
  return (
    <UtilityIcon>
      {/* The menu entry stays as the last control in the bottom bar so it reads
          as an escape action instead of competing with the core game tabs. */}
      <path d="M6.5 6.5h8.5v11H6.5z" />
      <path d="M15 12h2.5" />
      <path d="M15.5 10.5l2 1.5-2 1.5" />
    </UtilityIcon>
  );
}

const navItems: Array<{ tab: AppTab; label: string; to: string; icon: ReactNode }> = [
  {
    tab: 'equipment',
    label: 'Equip',
    to: TAB_ROUTE_MAP.equipment,
    icon: (
      <NavIcon>
        {/* Outfitting is about upgrading the ship itself, so the icon uses a
            small hull silhouette plus a compact add-marker instead of a
            generic tool glyph that reads more like repair or settings. */}
        <path d="M6.5 12l5.5-4 5.5 4-5.5 4z" />
        <path d="M9.3 13.6l-1.6 2.4" />
        <path d="M14.7 13.6l1.6 2.4" />
        <path d="M18 7.5h4" />
        <path d="M20 5.5v4" />
      </NavIcon>
    )
  },
  {
    tab: 'status',
    label: 'Status',
    to: TAB_ROUTE_MAP.status,
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
    to: TAB_ROUTE_MAP['system-data'],
    icon: (
      <NavIcon>
        <circle cx="12" cy="12" r="7.5" />
        <path d="M12 10v5" />
        <circle cx="12" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
      </NavIcon>
    )
  },
  {
    tab: 'short-range-chart',
    label: 'Short',
    to: TAB_ROUTE_MAP['short-range-chart'],
    icon: (
      <NavIcon>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <path d="M12 6.8v2.2" />
        <path d="M12 15v2.2" />
        <path d="M6.8 12h2.2" />
        <path d="M15 12h2.2" />
      </NavIcon>
    )
  },
  {
    tab: 'galaxy-chart',
    label: 'Galaxy',
    to: TAB_ROUTE_MAP['galaxy-chart'],
    icon: (
      <NavIcon>
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="9" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="13.5" cy="15" r="1" fill="currentColor" stroke="none" />
      </NavIcon>
    )
  }
];

export function AppShell() {
  const location = useLocation();
  const setActiveTab = useGameStore((state) => state.setActiveTab);
  const setStartScreenVisible = useGameStore((state) => state.setStartScreenVisible);
  const universe = useGameStore((state) => state.universe);
  const commander = useGameStore((state) => state.commander);
  const startScreenVisible = useGameStore((state) => state.ui.startScreenVisible);
  const isTravelRoute = location.pathname === '/travel';
  const isMenuFlowRoute = location.pathname === '/load' || location.pathname === '/debug';
  const [hasEnteredStartMenu, setHasEnteredStartMenu] = useState(false);

  if (isTravelRoute) {
    // Travel owns its own full-screen chrome, so the shell strips everything
    // back to an outlet container while the flight view is active.
    return (
      <div className="app-shell app-shell--travel">
        <main>
          <Outlet />
        </main>
      </div>
    );
  }

  if (startScreenVisible && !hasEnteredStartMenu) {
    return <StartScreenLoader onContinue={() => setHasEnteredStartMenu(true)} />;
  }

  return (
    <div className="app-shell">
      <StartScreenGate />
      {isMenuFlowRoute ? null : (
        <header>
          {/* The header surfaces docked-state information only. Travel HUD data is
              rendered by the travel screen itself to avoid duplicated status bars. */}
          <div className="app-shell__header-row">
            <dl className="hud-grid" aria-label="Commander status">
              <div>
                <dt>Credits</dt>
                <dd>{formatCredits(commander.cash)}</dd>
              </div>
              <div>
                <dt>Level</dt>
                <dd>
                  {commander.level} · XP {commander.xp}
                </dd>
              </div>
              <div>
                <dt>System</dt>
                <dd>{universe.currentSystem}</dd>
              </div>
              <div>
                <dt>HP</dt>
                <dd>
                  {commander.hp} / {commander.maxHp}
                </dd>
              </div>
            </dl>
          </div>
          {/* The docked shell no longer shows a transient message banner; feedback
              stays inside the screen that triggered it instead. */}
        </header>
      )}

      <main>
        <Outlet />
      </main>

      {isMenuFlowRoute ? null : (
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
          <button
            type="button"
            className="tab-link tab-link--menu"
            onClick={() => setStartScreenVisible(true)}
            aria-label="Open start menu"
            title="Start Menu"
          >
            <MenuIcon />
            <span className="sr-only">Start Menu</span>
          </button>
        </nav>
      )}
    </div>
  );
}
