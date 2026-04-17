import { Link, Outlet } from 'react-router'

export default function RootLayout() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link>
        {' | '}
        <Link to="/about">About</Link>
        {' | '}
        <Link to="/add">Add</Link>
      </nav>
      <hr />
      <Outlet />
    </div>
  )
}
