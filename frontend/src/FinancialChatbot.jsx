import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, TrendingUp } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

console.log('API Key loaded:', OPENAI_API_KEY ? 'YES ✅' : 'NO ❌');
console.log('Key starts with:', OPENAI_API_KEY?.substring(0, 10));

// ===== CRITICAL FIX: Sanitize username =====
const sanitizeUsername = (username) => {
  if (!username) return '';
  // Remove markdown formatting (**, __, *, _)
  // Remove extra whitespace
  // Remove special characters that might cause issues
  return username
    .replace(/\*\*/g, '')  // Remove bold markdown
    .replace(/\*/g, '')    // Remove italic markdown
    .replace(/__/g, '')    // Remove bold markdown
    .replace(/_/g, '')     // Remove italic markdown
    .trim();               // Remove whitespace
};

export default function FinancialChatbot({ username: rawUsername, groups, expenses, onExpenseAdded }) {
  // Sanitize username on entry
  const username = sanitizeUsername(rawUsername);
  
  // Log for debugging
  useEffect(() => {
    console.log('FinancialChatbot received username:', rawUsername);
    console.log('FinancialChatbot sanitized username:', username);
  }, [rawUsername, username]);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m your financial assistant. I can help you:\n\n• Add expenses in natural language\n• Analyze your spending patterns\n• Answer questions about your finances\n\nTry: "Add $23 to group 1 paid by me for dinner" or "Show my spending trends"'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const buildContext = () => {
    const groupList = groups.map(g => 
      `Group "${g.name}" (ID: ${g.id}, Members: ${g.members?.join(', ') || 'none'})`
    ).join('\n');

    const recentExpenses = expenses.slice(0, 10).map(e => 
      `$${e.amount} - ${e.title} (Group: ${e.group || 'N/A'}, Date: ${e.date}, Paid by: ${e.paidBy})`
    ).join('\n');

    const totalSpent = expenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
    
    // Calculate spending by group
    const spendByGroup = {};
    expenses.forEach(e => {
      const group = e.group || 'Unknown';
      spendByGroup[group] = (spendByGroup[group] || 0) + Math.abs(e.amount || 0);
    });
    
    const topGroups = Object.entries(spendByGroup)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([group, amount]) => `${group}: $${amount.toFixed(2)}`)
      .join(', ');

    return {
      text: `
Current user: ${username}

Available groups:
${groupList || 'No groups yet'}

Recent expenses (last 10):
${recentExpenses || 'No expenses yet'}

Financial Summary:
- Total spending: $${totalSpent.toFixed(2)}
- Top spending groups: ${topGroups || 'N/A'}
- Number of expenses: ${expenses.length}
      `.trim(),
      
      structured: {
        username,
        groups: groups.length,
        totalSpent,
        recentExpenses: expenses.length,
        topSpendingGroup: Object.entries(spendByGroup).sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'
      }
    };
  };

  const parseExpenseCommand = (text) => {
  const t = text.trim();

  // amount: $12.34 or 12.34
  const mAmount = t.match(/(?:^|\s)\$?(\d+(?:\.\d{1,2})?)\b/);

  // group: requires the literal word "group" (or allow `to <group>` as a fallback)
  const mGroup = t.match(/\bgroup\s+([A-Za-z0-9_-]+)\b/i) || t.match(/\bto\s+([A-Za-z0-9_-]+)\b/i);

  // paid by: only capture if the phrase 'paid by' appears
  const mPaidBy = t.match(/\bpaid\s+by\s+([A-Za-z0-9_-]+)\b/i);

  // description: 'for ...' at the end
  const mDesc = t.match(/\bfor\s+(.+)$/i);

  if (!mAmount || !mGroup) return null;

  const amount = parseFloat(mAmount[1]);
  const groupIdentifier = mGroup[1];
  const paidByRaw = mPaidBy ? mPaidBy[1] : null;
  const description = mDesc ? mDesc[1].trim() : "Expense";

  // Find group by name or ID (case-insensitive, partial OK)
  const group = groups.find(g => {
    const idOk = String(g.id) === groupIdentifier;
    const nm = (g.name || "").toLowerCase();
    const q  = groupIdentifier.toLowerCase();
    return idOk || nm === q || nm.includes(q) || q.includes(nm);
  });
  if (!group) return null;

  // sanitize username helper from your file
  const normalizedUser = sanitizeUsername(username);

  let resolvedPaidBy = normalizedUser;
  if (paidByRaw) {
    const s = sanitizeUsername(paidByRaw);
    resolvedPaidBy = s.toLowerCase() === "me" || s.toLowerCase() === normalizedUser.toLowerCase()
      ? normalizedUser
      : s;
  }

  return {
    amount,
    groupId: group.id,
    groupName: group.name,
    paidBy: resolvedPaidBy,
    title: description
    };
  };

  const addExpense = async (expenseData) => {
    try {
      const payload = {
        groupId: expenseData.groupId,
        title: expenseData.title,
        amount: expenseData.amount,
        date: new Date().toISOString().slice(0, 10),
        paidBy: expenseData.paidBy, // Already sanitized
        split: {
          type: 'equal',
          members: groups.find(g => g.id === expenseData.groupId)?.members || []
        },
        notes: 'Added via AI chatbot'
      };

      console.log('Sending expense payload:', payload);

      const response = await fetch(`${API}/api/expenses/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (response.ok) {
        // Notify parent component to refresh expenses
        if (onExpenseAdded) onExpenseAdded();
        return `✅ Successfully added $${expenseData.amount.toFixed(2)} expense "${expenseData.title}" to group "${expenseData.groupName}"!\n\nPaid by: ${expenseData.paidBy}`;
      } else {
        console.error('Failed to add expense:', data);
        return `❌ Failed to add expense: ${data.error || 'Unknown error'}`;
      }
    } catch (error) {
      console.error('Error adding expense:', error);
      return `❌ Error adding expense: ${error.message}`;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Check if it's an expense command
      const expenseData = parseExpenseCommand(userMessage);
      
      if (expenseData) {
        const result = await addExpense(expenseData);
        setMessages(prev => [...prev, { role: 'assistant', content: result }]);
        setIsLoading(false);
        return;
      }

      // Check if API key is configured
      if (!OPENAI_API_KEY) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: '❌ OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your environment variables.' 
        }]);
        setIsLoading(false);
        return;
      }

      // Otherwise, use OpenAI for insights
      const context = buildContext();
      const systemPrompt = `You are a helpful financial assistant for an expense splitting app. 

${context.text}

Provide helpful, concise insights about spending patterns, answer questions about expenses, and help users understand their finances. Be friendly and conversational. Use the data provided to give specific, actionable advice.

When giving financial insights:
- Be specific with numbers and percentages
- Identify trends and patterns
- Suggest areas to save money
- Compare spending across groups
- Highlight unusual expenses

If the user asks to add an expense, explain that they should use natural language like:
- "Add $23 to group 1 paid by me for dinner"
- "Spent $50 on coffee in group work"
- "$15 for lunch group friends paid by john"`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      });

      const data = await response.json();
      
      if (response.ok && data.choices && data.choices[0]) {
        const assistantMessage = data.choices[0].message.content;
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: assistantMessage 
        }]);
      } else {
        const errorMsg = data.error?.message || 'Unknown error';
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `❌ Sorry, I encountered an error: ${errorMsg}` 
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ Sorry, I encountered an error: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            borderRadius: '50%',
            boxShadow: '0 10px 40px rgba(139, 92, 246, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            zIndex: 1000
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageCircle style={{ color: 'white' }} size={24} />
        </button>
      )}

      {/* Chat Modal */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '384px',
          height: '600px',
          background: '#1e293b',
          borderRadius: '16px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          border: '1px solid #334155'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid #334155',
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            borderRadius: '16px 16px 0 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp style={{ color: 'white' }} size={20} />
              <h3 style={{ fontWeight: 'bold', color: 'white', margin: 0, fontSize: '16px' }}>Financial Assistant</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                color: 'white',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '8px',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '12px',
                    borderRadius: '16px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, #8b5cf6, #06b6d4)'
                      : '#334155',
                    color: 'white',
                    whiteSpace: 'pre-wrap',
                    fontSize: '14px',
                    lineHeight: '1.5'
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  background: '#334155',
                  padding: '12px',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'white'
                }}>
                  <Loader2 style={{ color: '#a78bfa', animation: 'spin 1s linear infinite' }} size={16} />
                  <span style={{ fontSize: '14px' }}>Thinking...</span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '16px',
            borderTop: '1px solid #334155'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything or add an expense..."
                disabled={isLoading}
                rows={2}
                style={{
                    flex: 1,
                    background: '#334155',
                    color: 'white',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    border: 'none',
                    outline: 'none',
                    fontSize: '14px',
                    resize: 'none',
                    fontFamily: 'inherit',
                    display: 'flex'
                }}
              
              />
              <div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                style={{
                  background: (!input.trim() || isLoading) ? '#64748b' : 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  border: 'none',
                  cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  alignSelf: 'stretch'
                }}
              >
                <Send size={18} />
              </button>
              </div>
            </div>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', marginBottom: 0 }}>
              Try: "Add $20 to group 1 for dinner" or "Show spending trends"
            </p>
          </div>
        </div>
      )}
    </>
  );
}