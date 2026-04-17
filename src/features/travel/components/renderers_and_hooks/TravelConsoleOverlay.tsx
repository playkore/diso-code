import type { AppTab } from '../../../../shared/store/types';
import { EquipmentScreen } from '../../../commander/components/EquipmentScreen';
import { InventoryScreen } from '../../../commander/components/InventoryScreen';
import { GalaxyChartScreen } from '../../../galaxy/components/GalaxyChartScreen';
import { StarMapScreen } from '../../../galaxy/components/StarMapScreen';
import { SystemDataScreen } from '../../../galaxy/components/SystemDataScreen';

interface TravelConsoleOverlayProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onClose: () => void;
}

const consoleTabs: Array<{ tab: AppTab; label: string }> = [
  { tab: 'equipment', label: 'Equip Ship' },
  { tab: 'status', label: 'Status' },
  { tab: 'system-data', label: 'System' },
  { tab: 'short-range-chart', label: 'Short' },
  { tab: 'galaxy-chart', label: 'Galaxy' }
];

function CloseIcon() {
  return (
    <svg className="travel-console__close-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

function renderConsoleScreen(tab: AppTab) {
  switch (tab) {
    case 'equipment':
      return <EquipmentScreen />;
    case 'status':
      return <InventoryScreen />;
    case 'system-data':
      return <SystemDataScreen />;
    case 'short-range-chart':
      return <StarMapScreen />;
    case 'galaxy-chart':
    default:
      return <GalaxyChartScreen />;
  }
}

/**
 * The console reuses the docked information screens but keeps them inside the
 * travel view so opening it simply pauses flight instead of changing routes.
 */
export function TravelConsoleOverlay({ activeTab, onSelectTab, onClose }: TravelConsoleOverlayProps) {
  return (
    <div className="travel-console" role="dialog" aria-modal="true" aria-label="Ship console">
      <div className="travel-console__panel">
        <div className="travel-console__tabs" role="tablist" aria-label="Ship console sections">
          {consoleTabs.map((item) => (
            <button
              key={item.tab}
              type="button"
              role="tab"
              aria-selected={activeTab === item.tab}
              className={`travel-console__tab${activeTab === item.tab ? ' is-active' : ''}`}
              onClick={() => onSelectTab(item.tab)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="travel-console__content">{renderConsoleScreen(activeTab)}</div>
        <div className="travel-console__footer">
          <button type="button" className="travel-console__close" onClick={onClose} aria-label="Close console">
            <CloseIcon />
            <span>Close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
