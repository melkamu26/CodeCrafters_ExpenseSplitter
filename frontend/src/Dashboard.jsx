// Dashboard.jsx
import { useState, useEffect } from 'react'
import Home from './Home'
import Groups from './Groups'
import GroupDetails from './GroupDetails'
import Analytics from './Analytics'
import ReceiptUpload from './ReceiptUpload'
import FinancialChatbot from './FinancialChatbot'
import Payments from './Payments'
import Summarization from './Summarization'
import SettlementSuggestions from './SettlementSuggestions'

// icons
import {
  Home as HomeIcon,
  Users,
  PlusCircle,
  Upload as UploadIcon,
  Scale,
  CreditCard,
  Sparkles,
  BarChart3,
  LogOut
} from 'lucide-react'

const API = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5050'

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
    loadGroups()
    loadRecentExpenses()
  }

  const goAddExpense = (g = null) => {
    setSelectedGroup(g || null)
    setTab('addExpense')
  }

  const handleExtracted = (data) => {
    try { sessionStorage.setItem('receiptData', JSON.stringify(data)) } catch {}
    goAddExpense()
  }

  const NavButton = ({ id, icon: Icon, children, onClick }) => (
    <button
      className={tab === id ? 'nav-btn active nav-btn-icon' : 'nav-btn nav-btn-icon'}
      onClick={onClick}
    >
      <Icon size={18} className="nav-ico" />
      <span>{children}</span>
    </button>
  )

  return (
    <div className="dash-wrap">
      <aside className="dash-sidebar">
        <div className="dash-brand">Expense Splitter</div>

        {/* Record */}
        <div className="dash-section">
          <div className="dash-section-label">Record</div>
          <nav className="dash-nav">
            <NavButton id="home" icon={HomeIcon} onClick={() => setTab('home')}> Home</NavButton>
            <NavButton id="groups" icon={Users} onClick={() => setTab('groups')}> Groups</NavButton>
            <NavButton id="addExpense" icon={PlusCircle} onClick={() => goAddExpense()}> Add Expense
            </NavButton>
            <NavButton id="upload" icon={UploadIcon} onClick={() => setTab('upload')}> Upload Receipt
            </NavButton>
          </nav>
        </div>

        {/* Settle */}
        <div className="dash-section">
          <div className="dash-section-label">Settle</div>
          <nav className="dash-nav">
            <NavButton id="settlements" icon={Scale} onClick={() => setTab('settlements')}> Settlements
            </NavButton>
            <NavButton id="payments" icon={CreditCard} onClick={() => setTab('payments')}> Payments
            </NavButton>
          </nav>
        </div>

        {/* Understand */}
        <div className="dash-section">
          <div className="dash-section-label">Understand</div>
          <nav className="dash-nav">
            <NavButton id="summary" icon={Sparkles} onClick={() => setTab('summary')}> Summary
            </NavButton>
            <NavButton id="analytics" icon={BarChart3} onClick={() => setTab('analytics')}> Analytics
            </NavButton>
          </nav>
        </div>

        <button className="logout-btn nav-btn-icon" onClick={onLogout}>
          <LogOut size={18} className="nav-ico" />
          <span> Logout</span>
        </button>
      </aside>

      <main className="dash-main">
        {tab === 'home' && (
          <Home
            username={username}
            onNavigate={(next, payload) => {
              if (next === 'addExpense') return goAddExpense(payload || null)
              setTab(next)
            }}
          />
        )}

        {tab === 'groups' && <Groups username={username} onOpen={goAddExpense} />}

        {tab === 'addExpense' && (
          <GroupDetails
            key={selectedGroup?.id || 'add-expense-new'}
            username={username}
            group={selectedGroup}
            onPickGroup={goAddExpense}
            titleOverride="Add Expenses"
          />
        )}

        {tab === 'payments' && <Payments username={username} />}
        {tab === 'summary' && <Summarization username={username} />}
        {tab === 'settlements' && <SettlementSuggestions username={username} />}
        {tab === 'analytics' && <Analytics username={username} />}

        {tab === 'upload' && (
          <div className="page">
            <div className="page-header"><h1 className="title">Upload Receipt</h1></div>
            <div className="panel" style={{ maxWidth: 520 }}>
              <ReceiptUpload onExtractData={handleExtracted} onClose={() => setTab('home')} />
            </div>
          </div>
        )}

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