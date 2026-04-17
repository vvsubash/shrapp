import { Link, Outlet } from 'react-router'
import { authClient } from '../lib/auth-client'

export default function RootLayout() {
  const { data: session } = authClient.useSession()

  return (
    <div>
      <nav>
        <Link to="/">Home</Link>
        {' | '}
        <Link to="/about">About</Link>
        {' | '}
        <Link to="/add">Add</Link>
        {' | '}
        {session ? (
          <Link to="/dashboard">{session.user.name}</Link>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </nav>
      <hr />
      <Outlet />
    </div>
  )
}
