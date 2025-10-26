import { useState } from 'react'
import Home from './Home'
import Groups from './Groups'

export default function Dashboard({ username, onLogout }) {
  const [tab, setTab] = useState('home')

  const go = (t) => setTab(t)

  return (
    <div className="dash-wrap">
      <aside className="dash-sidebar">
        <div className="dash-brand">Expense Splitter</div>
        <nav className="dash-nav">
          <button className={tab==='home'?'nav-btn active':'nav-btn'} onClick={()=>go('home')}>Home</button>
          <button className={tab==='groups'?'nav-btn active':'nav-btn'} onClick={()=>go('groups')}>Groups</button>
        </nav>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </aside>

      <main className="dash-main">
        {tab === 'home' && <Home username={username} onNavigate={go} />}
        {tab === 'groups' && <Groups username={username} />}
      </main>
    </div>
  )
}