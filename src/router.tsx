import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from './App'
import { Auth, ManifestPage, PublicQRPage, ProtectedRoute } from './components'

export const router = createBrowserRouter([
  // Public routes (no auth required)
  {
    path: '/login',
    element: <Auth />,
  },
  {
    path: '/manifest/:id',
    element: <ManifestPage />,
  },
  {
    path: '/qr/:id',
    element: <PublicQRPage />,
  },
  // Protected routes (auth required)
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <App />,
      },
      {
        path: '/create',
        element: <App initialView="create" />,
      },
      {
        path: '/edit/:id',
        element: <App initialView="edit" />,
      },
    ],
  },
  // Catch-all redirect
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
