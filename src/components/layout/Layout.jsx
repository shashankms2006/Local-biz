import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  return (
    <div className="workspace-shell">
      <Sidebar />
      <div className="workspace-main">
        <Header />
        <main className="workspace-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}