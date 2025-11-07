import { useEffect, useState } from 'react'
//import { useEffect, useState } from 'react'
import ReceiptUpload from './ReceiptUpload'

const API = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000'

  
  export default function Home({ username, onNavigate }) {
  const [stats, setStats] = useState({ groups: 0, members: 0, expenses: 0 })
  const [recent, setRecent] = useState([])
  const [showReceiptUpload, setShowReceiptUpload] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const gs = await fetch(`${API}/api/groups/list?user=${encodeURIComponent(username)}`)
        const gl = await gs.json()
        if (!active) return
        const gCount = Array.isArray(gl) ? gl.length : 0
        setStats(s => ({ ...s, groups: gCount }))
      } catch {}
      try {
        const rs = await fetch(`${API}/api/expenses/recent?user=${encodeURIComponent(username)}`)
        const rl = await rs.json()
        if (!active) return
        setRecent(Array.isArray(rl) ? rl.slice(0,5) : [])
        const m = new Set()
        for (const e of Array.isArray(rl)?rl:[]) if (e.members) e.members.forEach(x=>m.add(x))
        setStats(s => ({ ...s, members: m.size || s.members }))
      } catch (e) {
        console.error('Recent expenses error:', e)}
    })()
    return () => { active = false }
  }, [username])

  const handleReceiptData = (data) => {
    // Store extracted data in session storage or pass to GroupDetails
    sessionStorage.setItem('receiptData', JSON.stringify(data))
    setShowReceiptUpload(false)
    onNavigate('addExpense')
  }

  const currency = v => Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v||0)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="title">Welcome, {username}</h1>
          <p className="subtitle">Track expenses, manage groups, and settle up faster</p>
        </div>
      </div>

      <div className="grid-3">
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
          <div className="kpi-value">{currency(recent.reduce((a,b)=>a+Math.abs(b.amount||0),0))}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">Recent Expenses</div>
          {recent.length === 0 ? (
            <div className="empty">No recent expenses</div>
          ) : (
            <ul className="list">
              {recent.map((e,i)=>(
                <li key={i} className="list-row">
                  <div className="list-main">
                    <div className="list-title">{e.title || 'Expense'}</div>
                    <div className="list-sub">{(e.group)||'Personal'} • {new Date(e.date||Date.now()).toLocaleDateString()}</div>
                  </div>
                  <div className={'amount ' + ((e.type==='credit'||(e.amount||0)<0)?'pos':'neg')}>
                    {currency(Math.abs(e.amount||0))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">Quick Actions</div>
          <div className="actions-grid">
            <button className="action" onClick={()=>onNavigate('groups')}>Create Group</button>
            <button className="action" onClick={()=>onNavigate('groups')}>Add Member</button>
            <button className="action" onClick={()=>onNavigate('addExpense')}>Add Expense</button>
            <button className="action" onClick={()=>setShowReceiptUpload(true)}>Upload Receipt</button>
            <button className="action">Settle Up</button>
            <button className="action">View Reports</button>
          </div>
        </div>
      </div>

       {showReceiptUpload && (
        <ReceiptUpload 
          onExtractData={handleReceiptData}
          onClose={() => setShowReceiptUpload(false)}
        />
      )}
    </div>
  )
}