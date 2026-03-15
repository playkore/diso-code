import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { InventoryScreen } from './screens/InventoryScreen';
import { MarketScreen } from './screens/MarketScreen';
import { MissionsScreen } from './screens/MissionsScreen';
import { SaveLoadScreen } from './screens/SaveLoadScreen';
import { SystemDataScreen } from './screens/SystemDataScreen';
import { StarMapScreen } from './screens/StarMapScreen';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <MarketScreen /> },
      { path: 'inventory', element: <InventoryScreen /> },
      { path: 'galaxy', element: <Navigate to="/star-map" replace /> },
      { path: 'system-data', element: <SystemDataScreen /> },
      { path: 'star-map', element: <StarMapScreen /> },
      { path: 'missions', element: <MissionsScreen /> },
      { path: 'save-load', element: <SaveLoadScreen /> },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
