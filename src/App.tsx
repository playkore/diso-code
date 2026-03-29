import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { StartScreenGate } from './components/StartScreenGate';
import { BackgroundDebugScreen } from './screens/BackgroundDebugScreen';
import { EquipmentScreen } from './screens/EquipmentScreen';
import { GalaxyChartScreen } from './screens/GalaxyChartScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { MarketScreen } from './screens/MarketScreen';
import { SaveLoadScreen } from './screens/SaveLoadScreen';
import { SystemDataScreen } from './screens/SystemDataScreen';
import { StarMapScreen } from './screens/StarMapScreen';
import { TravelScreen } from './screens/TravelScreen';

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
      { path: 'travel', element: <TravelScreen /> },
      { path: 'debug/backgrounds', element: <BackgroundDebugScreen /> },
      { path: 'save-load', element: <SaveLoadScreen /> },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
]);

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <StartScreenGate />
    </>
  );
}
