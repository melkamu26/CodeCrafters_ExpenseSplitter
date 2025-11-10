import { useState, useEffect } from 'react'
import { DollarSign, Check, Clock, CreditCard } from 'lucide-react'

const API = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000'

export default function Payments({ username }) {
  const [pendingPayments, setPendingPayments] = useState([])
  const [paymentHistory, setPaymentHistory] = useState([])
  const [totalOwed, setTotalOwed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [processingPayment, setProcessingPayment] = useState(null)
  const [activeTab, setActiveTab] = useState('pending') // 'pending' or 'history'

  const loadPayments = async () => {
    try {
      setLoading(true)
      
      // Load pending payments
      const pendingRes = await fetch(`${API}/api/payments/pending?user=${encodeURIComponent(username)}`)
      const pendingData = await pendingRes.json()
      
      if (pendingRes.ok) {
        setPendingPayments(pendingData.pending || [])
        setTotalOwed(pendingData.total_owed || 0)
      }
      
      // Load payment history
      const historyRes = await fetch(`${API}/api/payments/history?user=${encodeURIComponent(username)}`)
      const historyData = await historyRes.json()
      
      if (historyRes.ok) {
        setPaymentHistory(historyData || [])
      }
    } catch (error) {
      setMessage('❌ Failed to load payments')
      console.error('Error loading payments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [username])

  const handlePayment = async (payment) => {
    if (processingPayment === payment.expense_id) return
    
    setProcessingPayment(payment.expense_id)
    setMessage('')
    
    try {
      const response = await fetch(`${API}/api/payments/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenseId: payment.expense_id,
          username: username,
          amount: payment.amount_owed
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage('✅ Payment recorded successfully!')
        // Reload payments to reflect changes
        await loadPayments()
        
        // Clear message after 3 seconds
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('❌ ' + (data.error || 'Payment failed'))
      }
    } catch (error) {
      setMessage('❌ Error processing payment')
      console.error('Payment error:', error)
    } finally {
      setProcessingPayment(null)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const currency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0)
  }

  if (loading) {
    return (
      <div className="page">
        <div className="panel">
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading payments...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="title">Payments</h1>
          <p className="subtitle">Manage your expense settlements</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid-3">
        <div className="kpi">
          <div className="kpi-label">Total Owed</div>
          <div className="kpi-value" style={{ color: totalOwed > 0 ? '#fb7185' : '#34d399' }}>
            {currency(totalOwed)}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pending Payments</div>
          <div className="kpi-value">{pendingPayments.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Completed Payments</div>
          <div className="kpi-value">{paymentHistory.length}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '1rem',
        borderBottom: '2px solid var(--line)',
        paddingBottom: '0.5rem'
      }}>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'pending' ? 'linear-gradient(135deg, var(--p1), var(--p2))' : 'transparent',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          <Clock size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
          Pending ({pendingPayments.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'history' ? 'linear-gradient(135deg, var(--p1), var(--p2))' : 'transparent',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          <Check size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
          History
        </button>
      </div>

      {/* Pending Payments Tab */}
      {activeTab === 'pending' && (
        <div className="panel">
          <div className="panel-title">
            <DollarSign size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Pending Payments
          </div>
          
          {pendingPayments.length === 0 ? (
            <div className="empty">
              <Check size={48} style={{ marginBottom: '1rem', color: '#34d399' }} />
              <p>All caught up! No pending payments.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {pendingPayments.map((payment, index) => (
                <div 
                  key={index}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '1rem',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                      {payment.title}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      <span style={{ marginRight: '1rem' }}>
                        Group: {payment.group_name}
                      </span>
                      <span style={{ marginRight: '1rem' }}>
                        Date: {formatDate(payment.date)}
                      </span>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      fontSize: '0.9rem',
                      color: '#94a3b8'
                    }}>
                      <span>Total: {currency(payment.total_amount)}</span>
                      <span>•</span>
                      <span>Paid by: {payment.paid_by}</span>
                      <span>•</span>
                      <span style={{ 
                        color: '#fb7185',
                        fontWeight: '700'
                      }}>
                        You owe: {currency(payment.amount_owed)}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handlePayment(payment)}
                    disabled={processingPayment === payment.expense_id}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: processingPayment === payment.expense_id 
                        ? '#64748b' 
                        : 'linear-gradient(135deg, #22c55e, #16a34a)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontWeight: '700',
                      cursor: processingPayment === payment.expense_id ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <CreditCard size={18} />
                    {processingPayment === payment.expense_id ? 'Processing...' : 'Pay Now'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payment History Tab */}
      {activeTab === 'history' && (
        <div className="panel">
          <div className="panel-title">
            <Check size={20} style={{ display: 'inline', marginRight: '0.5rem', color: '#34d399' }} />
            Payment History
          </div>
          
          {paymentHistory.length === 0 ? (
            <div className="empty">No payment history yet</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {paymentHistory.map((payment, index) => (
                <div 
                  key={index}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>
                      {payment.expense_title}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                      {payment.group_name} • Paid on {formatDateTime(payment.paid_at)}
                    </div>
                  </div>
                  <div style={{ 
                    fontWeight: '800',
                    color: '#34d399',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Check size={16} />
                    {currency(payment.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast Message */}
      {message && (
        <div 
          className={`toast ${message.includes('✅') ? 'ok' : 'err'}`}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            zIndex: 1000
          }}
        >
          {message}
        </div>
      )}
    </div>
  )
}