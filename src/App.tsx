import { Suspense, lazy } from 'react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { EquipmentScreen } from './screens/EquipmentScreen';
import { GalaxyChartScreen } from './screens/GalaxyChartScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { MarketScreen } from './screens/MarketScreen';
import { SaveLoadScreen } from './screens/SaveLoadScreen';
import { SystemDataScreen } from './screens/SystemDataScreen';
import { StarMapScreen } from './screens/StarMapScreen';

// Travel is the only route that pulls in Three.js and the full flight renderer,
// so loading it lazily keeps docked screens out of that heavier dependency path.
const TravelScreen = lazy(() => import('./screens/TravelScreen').then((module) => ({ default: module.TravelScreen })));

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
      { path: 'save-load', element: <SaveLoadScreen /> },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
