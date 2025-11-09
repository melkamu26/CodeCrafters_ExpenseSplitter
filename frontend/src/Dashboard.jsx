// Dashboard.jsx
import { useState } from 'react'
import Home from './Home'
import Groups from './Groups'
import GroupDetails from './GroupDetails'
import Analytics from './Analytics'
import ReceiptUpload from './ReceiptUpload'

export default function Dashboard({ username, onLogout }) {
  const [tab, setTab] = useState('home')
  const [selectedGroup, setSelectedGroup] = useState(null)

  const goAddExpense = (g = null) => {
    setSelectedGroup(g || null)
    setTab('addExpense')
  }

  const handleExtracted = (data) => {
    try { sessionStorage.setItem('receiptData', JSON.stringify(data)) } catch {}
    goAddExpense()  // jump to Add Expense after OCR
  }

  return (
    <div className="dash-wrap">
      <aside className="dash-sidebar">
        <div className="dash-brand">Expense Splitter</div>
        <nav className="dash-nav">
          <button className={tab==='home'?'nav-btn active':'nav-btn'} onClick={()=>setTab('home')}>Home</button>
          <button className={tab==='groups'?'nav-btn active':'nav-btn'} onClick={()=>setTab('groups')}>Groups</button>
          <button className={tab==='addExpense'?'nav-btn active':'nav-btn'} onClick={()=>goAddExpense()}>Add Expenses</button>
          <button className={tab==='analytics'?'nav-btn active':'nav-btn'} onClick={()=>setTab('analytics')}>Analytics</button>
          <button className={tab==='upload'?'nav-btn active':'nav-btn'} onClick={()=>setTab('upload')}>Upload Receipt</button>
        </nav>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </aside>

      <main className="dash-main">
        {tab === 'home' && (
          <Home
            username={username}
            onNavigate={(next, payload) => {
              if (next === 'addExpense') return goAddExpense(payload || null)
              setTab(next) // supports 'groups' | 'analytics' | 'upload'
            }}
          />
        )}

        {tab === 'groups' && (
          <Groups username={username} onOpen={goAddExpense} />
        )}

        {tab === 'addExpense' && (
          <GroupDetails
            key={selectedGroup?.id || 'add-expense-new'}  // force clean mount
            username={username}
            group={selectedGroup}                         // may be null; see guard below
            onPickGroup={goAddExpense}
            titleOverride="Add Expenses"
          />
        )}

        {tab === 'analytics' && <Analytics username={username} />}

        {tab === 'upload' && (
          <div className="page">
            <div className="page-header"><h1 className="title">Upload Receipt</h1></div>
            <div className="panel" style={{ maxWidth: 520 }}>
              <ReceiptUpload
                onExtractData={handleExtracted}
                onClose={()=>setTab('home')}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}