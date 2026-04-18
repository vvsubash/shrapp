import type { RouteObject } from 'react-router'
import RootLayout from './layouts/RootLayout'
import ProtectedRoute from './layouts/ProtectedRoute'
import GuestRoute from './layouts/GuestRoute'
import Home from './pages/Home/Home'
import About from './pages/About'
import Add from './pages/add'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      // Guest-only routes — logged-in users get redirected to /
      {
        element: <GuestRoute />,
        children: [
          { path: 'login', element: <Login /> },
        ],
      },
      // Protected routes — unauthenticated users get redirected to /login
      {
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <Home /> },
          { path: 'about', element: <About /> },
          { path: 'add', element: <Add /> },
          { path: 'dashboard', element: <Dashboard /> },
        ],
      },
    ],
  },
]
