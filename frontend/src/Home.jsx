import { useEffect, useState } from 'react'
import ReceiptUpload from './ReceiptUpload'

const API = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000'

const fmtUSD = v =>
  Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(v || 0))

const fmtMDY = s => {
  if (!s) return ''
  // handle ISO "YYYY-MM-DD" or Date
  const d = typeof s === 'string' ? new Date(s) : new Date(s)
  if (isNaN(d)) return s
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

export default function Home({ username, onNavigate }) {
  const [stats, setStats] = useState({ groups: 0, members: 0 })
  const [recent, setRecent] = useState([])
  const [showReceiptUpload, setShowReceiptUpload] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const gs = await fetch(`${API}/api/groups/list?user=${encodeURIComponent(username)}`)
        const gl = await gs.json()
        if (!active) return
        const list = Array.isArray(gl) ? gl : []
        const gCount = list.length
        const members = new Set()
        list.forEach(g => g.members?.forEach(m => members.add(m)))
        setStats({ groups: gCount, members: members.size })
      } catch {}

      try {
        const rs = await fetch(`${API}/api/expenses/recent?user=${encodeURIComponent(username)}`)
        const rl = await rs.json()
        if (!active) return
        setRecent(Array.isArray(rl) ? rl.slice(0, 5) : [])
      } catch {}
    })()
    return () => { active = false }
  }, [username])

  const handleReceiptData = (data) => {
    // save for AddExpense to prefill
    sessionStorage.setItem('receiptData', JSON.stringify(data))
    setShowReceiptUpload(false)
    onNavigate('addExpense')
  }

  return (
    <div className="page" style={{ gap: 14 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="title">Welcome, {username}</h1>
          <p className="subtitle">Track expenses, manage groups, and settle up faster</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-3" style={{ alignItems: 'stretch' }}>
        <div className="kpi">
          <div className="kpi-label">Groups</div>
          <div className="kpi-value">{stats.groups}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Members</div>
          <div className="kpi-value">{stats.members}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Recent Spend</div>
          <div className="kpi-value">
            {fmtUSD(recent.reduce((a, b) => a + Math.abs(b.amount || 0), 0))}
          </div>
        </div>
      </div>

      {/* Main Row */}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Recent Expenses */}
        <div className="panel" style={{ minHeight: 420, display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title" style={{ marginBottom: 4 }}>Recent Expenses</div>

          {recent.length === 0 ? (
            <div className="empty" style={{ marginTop: 6 }}>No recent expenses</div>
          ) : (
            <ul className="list" style={{ overflowY: 'auto', maxHeight: 360 }}>
              {recent.map((e, i) => (
                <li key={i} className="list-row">
                  <div className="list-main">
                    <div className="list-title">{e.title || 'Expense'}</div>
                    <div className="list-sub">
                      {(e.group) || 'Personal'} • {fmtMDY(e.date)}
                    </div>
                  </div>
                  <div className={'amount ' + ((e.amount || 0) < 0 ? 'pos' : 'neg')}>
                    {fmtUSD(e.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick Actions */}
        <div className="panel" style={{ minHeight: 420, display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>Quick Actions</div>
          <div className="actions-grid" style={{ marginTop: 0, flex: 1 }}>
            <button className="action" onClick={() => onNavigate('groups')}>Create Group</button>
            <button className="action" onClick={() => onNavigate('groups')}>Add Member</button>
            <button className="action" onClick={() => onNavigate('addExpense')}>Add Expense</button>
            <button className="action" onClick={() => setShowReceiptUpload(true)}>Upload Receipt</button>
            <button className="action" onClick={() => onNavigate('settle')}>Settle Up</button>
            <button className="action" onClick={() => onNavigate('analytics')}>View Reports</button>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceiptUpload && (
        <ReceiptUpload
          onExtractData={handleReceiptData}
          onClose={() => setShowReceiptUpload(false)}
        />
      )}
    </div>
  )
}