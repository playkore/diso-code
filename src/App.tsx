import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { MobileFullscreenGate } from './components/MobileFullscreenGate';
import { BackgroundDebugScreen } from './screens/BackgroundDebugScreen';
import { EquipmentScreen } from './screens/EquipmentScreen';
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
      { path: 'inventory', element: <InventoryScreen /> },
      { path: 'galaxy', element: <Navigate to="/star-map" replace /> },
      { path: 'system-data', element: <SystemDataScreen /> },
      { path: 'star-map', element: <StarMapScreen /> },
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
      <MobileFullscreenGate />
    </>
  );
}
