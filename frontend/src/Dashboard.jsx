// Dashboard.jsx
//import { useState } from 'react'
import { useState, useEffect } from 'react'
import Home from './Home'
import Groups from './Groups'
import GroupDetails from './GroupDetails'
import Analytics from './Analytics'
import ReceiptUpload from './ReceiptUpload'
import FinancialChatbot from './FinancialChatbot'
import Payments from './Payments'

const API = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

export default function Dashboard({ username, onLogout }) {
  const [tab, setTab] = useState('home')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [groups, setGroups] = useState([])
  const [expenses, setExpenses] = useState([])

   useEffect(() => {
    loadGroups()
    loadRecentExpenses()
  }, [username])

  const loadGroups = async () => {
    try {
      const r = await fetch(`${API}/api/groups/list?user=${encodeURIComponent(username)}`)
      const d = await r.json()
      setGroups(Array.isArray(d) ? d : [])
    } catch (err) {
      console.error('Failed to load groups:', err)
    }
  }

  const loadRecentExpenses = async () => {
    try {
      const r = await fetch(`${API}/api/expenses/recent?user=${encodeURIComponent(username)}`)
      const d = await r.json()
      setExpenses(Array.isArray(d) ? d : [])
    } catch (err) {
      console.error('Failed to load expenses:', err)
    }
  }

  const handleExpenseAdded = () => {
    // Refresh data when chatbot adds an expense
    loadGroups()
    loadRecentExpenses()
  }

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
          <button className={tab==='payments'?'nav-btn active':'nav-btn'} onClick={()=>setTab('payments')}>Payments</button>
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

        {tab === 'payments' && <Payments username={username} />}

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

        {/* AI Chatbot - Always visible as floating button */}
        <FinancialChatbot
          username={username}
          groups={groups}
          expenses={expenses}
          onExpenseAdded={handleExpenseAdded}
        />
      </main>
    </div>
  )
}