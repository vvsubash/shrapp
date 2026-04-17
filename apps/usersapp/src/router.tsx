import type { RouteObject } from 'react-router'
import RootLayout from './layouts/RootLayout'
import Home from './pages/Home/Home'
import About from './pages/About'
import Add from './pages/add'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'about', element: <About /> },
      { path: 'add', element: <Add /> },
      { path: 'login', element: <Login /> },
      { path: 'dashboard', element: <Dashboard /> },
    ],
  },
]
