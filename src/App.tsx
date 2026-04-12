import { Suspense, lazy } from 'react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AppShell } from './shared/components/AppShell';
import { DebugScreen } from './shared/components/DebugScreen';
import { EquipmentScreen } from './features/commander/components/EquipmentScreen';
import { GalaxyChartScreen } from './features/galaxy/components/GalaxyChartScreen';
import { InventoryScreen } from './features/commander/components/InventoryScreen';
import { LoadScreen } from './features/persistence/components/LoadScreen';
import { MarketScreen } from './features/market/components/MarketScreen';
import { SystemDataScreen } from './features/galaxy/components/SystemDataScreen';
import { StarMapScreen } from './features/galaxy/components/StarMapScreen';

// Travel is the only route that pulls in Three.js and the full flight renderer,
// so loading it lazily keeps docked screens out of that heavier dependency path.
const TravelScreen = lazy(() => import('./features/travel/components/TravelScreen').then((module) => ({ default: module.TravelScreen })));

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <MarketScreen /> },
      { path: 'equipment', element: <EquipmentScreen /> },
      { path: 'status', element: <InventoryScreen /> },
      { path: 'inventory', element: <Navigate to="/status" replace /> },
      { path: 'galaxy', element: <Navigate to="/galaxy-chart" replace /> },
      { path: 'system-data', element: <SystemDataScreen /> },
      { path: 'short-range-chart', element: <StarMapScreen /> },
      { path: 'star-map', element: <Navigate to="/short-range-chart" replace /> },
      { path: 'galaxy-chart', element: <GalaxyChartScreen /> },
      {
        path: 'travel',
        element: (
          // The fallback stays visually empty because the route transition is
          // already framed by the in-game UI shell and should not flash new UI.
          <Suspense fallback={null}>
            <TravelScreen />
          </Suspense>
        )
      },
      { path: 'load', element: <LoadScreen /> },
      { path: 'debug', element: <DebugScreen /> },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
