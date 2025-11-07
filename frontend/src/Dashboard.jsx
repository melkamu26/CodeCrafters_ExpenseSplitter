import { useState } from 'react'
import Home from './Home'
import Groups from './Groups'
import GroupDetails from './GroupDetails'

export default function Dashboard({ username, onLogout }) {
  const [tab, setTab] = useState('home')
  const [selectedGroup, setSelectedGroup] = useState(null)

  const openGroup = (g) => {
    setSelectedGroup(g)
    setTab('addExpense')
  }

  return (
    <div className="dash-wrap">
      <aside className="dash-sidebar">
        <div className="dash-brand">Expense Splitter</div>
        <nav className="dash-nav">
          <button className={tab==='home'?'nav-btn active':'nav-btn'} onClick={()=>setTab('home')}>Home</button>
          <button className={tab==='groups'?'nav-btn active':'nav-btn'} onClick={()=>setTab('groups')}>Groups</button>
          <button className={tab==='addExpense'?'nav-btn active':'nav-btn'} onClick={()=>setTab('addExpense')}>Add Expenses</button>
        </nav>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </aside>

      <main className="dash-main">
        {tab === 'home' && (
          <Home
            username={username}
            onNavigate={(t) => {
              if (t === 'addExpense') setSelectedGroup(null)
              setTab(t)
            }}
          />
        )}
        {tab === 'groups' && (
          <Groups username={username} onOpen={openGroup} />
        )}
        {tab === 'addExpense' && (
          <GroupDetails
            username={username}
            group={selectedGroup}
            onPickGroup={openGroup}
            titleOverride="Add Expenses"
          />
        )}
      </main>
    </div>
  )
}