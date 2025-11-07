import { useState } from 'react'

const API = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000'

export default function ReceiptUpload({ groups, onExtractData, onClose }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [extractedData, setExtractedData] = useState(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile)
      setMessage('')
    } else {
      setMessage('❌ Please select an image file')
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setMessage('❌ Please select an image')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch(`${API}/api/receipts/process`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        setExtractedData(data)
        setMessage('✅ Receipt processed successfully')
      } else {
        setMessage('❌ ' + (data.error || 'Failed to process receipt'))
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message)
    }
    setLoading(false)
  }

  if (extractedData) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: '#1e293b',
          padding: '24px',
          borderRadius: '12px',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflowY: 'auto',
          color: '#e2e8f0'
        }}>
          <h2 style={{ marginTop: 0 }}>Extracted Receipt Data</h2>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Amount</label>
            <div style={{ padding: '8px', backgroundColor: '#0f172a', borderRadius: '6px' }}>
              ${extractedData.amount.toFixed(2)}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Date</label>
            <div style={{ padding: '8px', backgroundColor: '#0f172a', borderRadius: '6px' }}>
              {extractedData.date}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Category</label>
            <div style={{ padding: '8px', backgroundColor: '#0f172a', borderRadius: '6px' }}>
              {extractedData.category}
            </div>
          </div>

          {extractedData.lineItems && extractedData.lineItems.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Line Items</label>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {extractedData.lineItems.map((item, i) => (
                  <li key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px',
                    backgroundColor: '#0f172a',
                    marginBottom: '4px',
                    borderRadius: '4px'
                  }}>
                    <span>{item.name}</span>
                    <span>${item.price.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => onExtractData(extractedData)}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Use This Data
            </button>
            <button
              onClick={() => {
                setExtractedData(null)
                setFile(null)
              }}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#64748b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Upload Another
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        padding: '24px',
        borderRadius: '12px',
        maxWidth: '400px',
        color: '#e2e8f0'
      }}>
        <h2 style={{ marginTop: 0 }}>Upload Receipt</h2>
        
        <div style={{
          border: '2px dashed #64748b',
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center',
          marginBottom: '16px',
          cursor: 'pointer',
          transition: 'all 0.3s'
        }}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="receipt-input"
          />
          <label htmlFor="receipt-input" style={{ cursor: 'pointer', display: 'block' }}>
            {file ? `✅ ${file.name}` : '📸 Click to select image or drag & drop'}
          </label>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading ? '#64748b' : '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            marginBottom: '10px'
          }}
        >
          {loading ? 'Processing...' : 'Process Receipt'}
        </button>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#64748b',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Cancel
        </button>

        {message && (
          <div style={{
            marginTop: '12px',
            padding: '10px',
            backgroundColor: message.includes('✅') ? '#166534' : '#991b1b',
            color: message.includes('✅') ? '#86efac' : '#fca5a5',
            borderRadius: '6px',
            fontSize: '14px'
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}