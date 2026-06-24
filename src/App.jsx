import { useState, useRef, useEffect } from 'react'

const DEMO_DOCS = [
  {
    id: 'doc1',
    name: 'AI Research Overview.txt',
    content: `Large language models (LLMs) are transformer-based neural networks trained on vast text corpora. Key architectures include GPT (autoregressive), BERT (masked language modeling), and T5 (encoder-decoder). RAG (Retrieval-Augmented Generation) combines LLMs with external knowledge retrieval, allowing models to access up-to-date information beyond their training cutoff. Vector databases like Pinecone, Weaviate, and Chroma store document embeddings for semantic search. Agentic AI systems can take multi-step actions, use tools, and make decisions autonomously to complete complex tasks.`,
    size: '1.2 KB',
  },
  {
    id: 'doc2',
    name: 'Company Handbook.txt',
    content: `Acme Corp was founded in 2018. We operate in 12 countries with 3,400 employees. Core values: Innovation, Integrity, Impact. Products: DataSync (data pipeline), CloudVault (storage), InsightAI (analytics). PTO policy: 25 days/year plus 10 public holidays. Performance reviews occur quarterly. Remote work: 3 days in office minimum per week. Benefits include health, dental, 401k with 4% match, and $2000 annual learning stipend.`,
    size: '0.8 KB',
  },
]

const SUGGESTIONS = [
  '⚡ What is RAG?',
  '📋 Summarize the handbook',
  '💰 What benefits are offered?',
  '🗄️ What are vector databases?',
]

// ── Groq API (ultra fast - uses LPU hardware) ─────────────────────────────
async function askGroq({ docs, messages, apiKey }) {
  const knowledge = docs.map(d => `[Doc: ${d.name}]\n${d.content}`).join('\n\n---\n\n')
  const systemText = `You are a lightning-fast RAG knowledge assistant. Answer questions using the provided documents.
When referencing a document use [Doc: filename] notation. Use **bold** for key terms. Be concise and accurate.
${knowledge ? `\n## Knowledge Base\n\n${knowledge}` : '\nNo documents loaded yet.'}`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',   // fastest + smartest Groq model
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemText },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `Groq API error ${res.status}`)
  return data.choices?.[0]?.message?.content || 'No response.'
}

// ── Markdown renderer ──────────────────────────────────────────────────────
function renderText(text) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: '0.4rem' }} />
    const parts = []
    const regex = /\*\*(.*?)\*\*|\[Doc:\s*([^\]]+)\]/g
    let last = 0, m
    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index))
      if (m[1] !== undefined)
        parts.push(<strong key={m.index} style={{ color: '#1d4ed8' }}>{m[1]}</strong>)
      else
        parts.push(
          <span key={m.index} style={{
            background: 'rgba(59,130,246,0.1)', color: '#2563eb',
            fontSize: '0.72rem', padding: '2px 8px', borderRadius: 20,
            fontWeight: 600, margin: '0 3px', border: '1px solid rgba(59,130,246,0.2)',
          }}>[Doc: {m[2]}]</span>
        )
      last = m.index + m[0].length
    }
    if (last < line.length) parts.push(line.slice(last))
    return <p key={i} style={{ margin: '0 0 0.25rem', lineHeight: 1.7 }}>{parts}</p>
  })
}

// ── Speed badge ────────────────────────────────────────────────────────────
function SpeedBadge({ ms }) {
  if (!ms) return null
  const color = ms < 1000 ? '#16a34a' : ms < 3000 ? '#d97706' : '#dc2626'
  return (
    <span style={{
      fontSize: '0.62rem', color, background: `${color}18`,
      border: `1px solid ${color}33`, borderRadius: 20,
      padding: '1px 7px', fontWeight: 700, marginLeft: 6,
    }}>⚡ {(ms / 1000).toFixed(2)}s</span>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [apiKey, setApiKey] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [docs, setDocs] = useState(DEMO_DOCS)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalTokens, setTotalTokens] = useState(0)
  const fileRef = useRef()
  const chatRef = useRef()

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, loading])

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => setDocs(prev => [...prev, {
        id: Date.now() + file.name,
        name: file.name,
        content: ev.target.result,
        size: (file.size / 1024).toFixed(1) + ' KB',
      }])
      reader.readAsText(file)
    })
  }

  async function send(text) {
    const q = (text || input).trim()
    if (!q || loading) return
    if (!apiKeySaved) { setError('Please enter and save your Groq API key first.'); setShowKeyInput(true); return }
    setInput('')
    setError('')
    const userMsg = { role: 'user', content: q, id: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)
    const start = Date.now()
    try {
      const reply = await askGroq({ docs, messages: newMessages, apiKey })
      const elapsed = Date.now() - start
      setMessages(prev => [...prev, {
        role: 'assistant', content: reply, id: Date.now(), elapsed,
      }])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredDocs = docs.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div style={{
      display: 'flex', height: '100vh',
      background: '#f8faff',
      color: '#1e293b', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #bfdbfe; border-radius: 4px; }
        textarea::placeholder, input::placeholder { color: #94a3b8 !important; }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:.3} 40%{transform:translateY(-6px);opacity:1} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .msg-in { animation: fadeIn 0.25s ease; }
        .chip:hover { background: #eff6ff !important; color: #2563eb !important; border-color: #bfdbfe !important; }
        .doc-row:hover { background: #eff6ff !important; border-color: #bfdbfe !important; }
        .send-btn:hover:not(:disabled) { background: #1d4ed8 !important; transform: scale(1.05); }
        .icon-btn:hover { background: #eff6ff !important; color: #2563eb !important; }
      `}</style>

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <div style={{
          width: 290, flexShrink: 0,
          background: 'white',
          borderRight: '1px solid #e0e7ff',
          display: 'flex', flexDirection: 'column',
          boxShadow: '4px 0 20px rgba(59,130,246,0.06)',
        }}>

          {/* Brand */}
          <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid #f0f4ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.85rem' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem', boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
              }}>⚡</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>Groq RAG</div>
                <div style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: 500 }}>Ultra-fast · LPU Powered</div>
              </div>
            </div>

            {/* Speed stats */}
            <div style={{
              background: 'linear-gradient(135deg, #eff6ff, #f5f3ff)',
              border: '1px solid #dbeafe', borderRadius: 10, padding: '0.6rem 0.85rem',
              display: 'flex', gap: '1rem',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#2563eb' }}>
                  {messages.filter(m => m.elapsed).length > 0
                    ? ((messages.filter(m => m.elapsed).reduce((a, m) => a + m.elapsed, 0) /
                        messages.filter(m => m.elapsed).length) / 1000).toFixed(2) + 's'
                    : '—'}
                </div>
                <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 500 }}>Avg Speed</div>
              </div>
              <div style={{ width: 1, background: '#dbeafe' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#7c3aed' }}>
                  {messages.filter(m => m.role === 'assistant').length}
                </div>
                <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 500 }}>Responses</div>
              </div>
              <div style={{ width: 1, background: '#dbeafe' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#16a34a' }}>{docs.length}</div>
                <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 500 }}>Docs</div>
              </div>
            </div>
          </div>

          {/* API Key */}
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #f0f4ff' }}>
            <button
              onClick={() => setShowKeyInput(s => !s)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0.4rem 0.5rem', borderRadius: 8, color: '#475569', fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span>🔑</span>
                <span style={{ fontWeight: 600, color: '#374151' }}>Groq API Key</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {apiKeySaved && (
                  <span style={{
                    background: '#dcfce7', color: '#16a34a', fontSize: '0.62rem',
                    padding: '2px 7px', borderRadius: 20, fontWeight: 700, border: '1px solid #bbf7d0',
                  }}>● Active</span>
                )}
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{showKeyInput ? '▲' : '▼'}</span>
              </div>
            </button>

            {showKeyInput && (
              <div style={{ marginTop: '0.5rem', animation: 'fadeIn 0.2s ease' }}>
                <input
                  type="password"
                  placeholder="gsk_..."
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setApiKeySaved(false) }}
                  style={{
                    width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0',
                    borderRadius: 8, padding: '0.5rem 0.75rem',
                    color: '#1e293b', fontSize: '0.8rem', outline: 'none', marginBottom: '0.4rem',
                  }}
                />
                <button
                  onClick={() => { if (apiKey.trim()) { setApiKeySaved(true); setShowKeyInput(false) } }}
                  style={{
                    width: '100%',
                    background: apiKeySaved ? '#dcfce7' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
                    border: apiKeySaved ? '1px solid #bbf7d0' : 'none',
                    color: apiKeySaved ? '#16a34a' : '#fff',
                    borderRadius: 8, padding: '0.5rem', fontSize: '0.82rem',
                    cursor: 'pointer', fontWeight: 700,
                    boxShadow: apiKeySaved ? 'none' : '0 4px 12px rgba(37,99,235,0.3)',
                  }}
                >{apiKeySaved ? '✓ Key Saved' : 'Save Key'}</button>
                <p style={{ fontSize: '0.63rem', color: '#94a3b8', marginTop: '0.35rem', textAlign: 'center' }}>
                  Free at <span style={{ color: '#2563eb' }}>console.groq.com</span> · No credit card
                </p>
              </div>
            )}
          </div>

          {/* Documents */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.85rem 1.25rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Knowledge Base
              </span>
              <span style={{
                background: '#eff6ff', color: '#2563eb',
                fontSize: '0.62rem', padding: '2px 7px', borderRadius: 20, fontWeight: 700,
              }}>{docs.length} docs</span>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '0.6rem' }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#94a3b8' }}>🔍</span>
              <input
                placeholder="Search docs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: 8, padding: '0.4rem 0.75rem 0.4rem 1.75rem',
                  fontSize: '0.76rem', outline: 'none', color: '#1e293b',
                }}
              />
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
              onClick={() => fileRef.current.click()}
              style={{
                border: `2px dashed ${dragOver ? '#2563eb' : '#bfdbfe'}`,
                borderRadius: 10, padding: '0.65rem',
                background: dragOver ? '#eff6ff' : '#f8fbff',
                cursor: 'pointer', textAlign: 'center', marginBottom: '0.6rem', transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '1rem' }}>⬆️</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Drop or <span style={{ color: '#2563eb', fontWeight: 600 }}>browse</span>
              </div>
              <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>.txt · .md · .csv · .json</div>
            </div>
            <input ref={fileRef} type="file" multiple accept=".txt,.md,.csv,.json"
              style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />

            {/* Doc list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredDocs.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.76rem', padding: '1rem 0' }}>
                  {searchQuery ? 'No matches found' : 'No docs yet'}
                </div>
              )}
              {filteredDocs.map(doc => (
                <div key={doc.id} className="doc-row" style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '0.5rem 0.65rem', borderRadius: 8,
                  background: '#f8fbff', border: '1px solid #e0e7ff',
                  marginBottom: '0.35rem', transition: 'all 0.15s',
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                    background: '#eff6ff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.72rem',
                  }}>📄</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: '0.73rem', fontWeight: 600, color: '#334155',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{doc.name}</div>
                    <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{doc.size}</div>
                  </div>
                  <button onClick={() => setDocs(p => p.filter(d => d.id !== doc.id))}
                    className="icon-btn"
                    style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 4px', borderRadius: 4 }}>✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '0.6rem 1.25rem', borderTop: '1px solid #f0f4ff',
            fontSize: '0.62rem', color: '#c7d2fe', textAlign: 'center',
          }}>
            Groq LPU · llama-3.3-70b · ~1-3s response
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          padding: '0.85rem 1.5rem', borderBottom: '1px solid #e0e7ff',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'white', flexShrink: 0,
          boxShadow: '0 2px 10px rgba(59,130,246,0.05)',
        }}>
          <button onClick={() => setSidebarOpen(s => !s)} className="icon-btn"
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem', padding: '0.3rem', borderRadius: 6 }}>
            ☰
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚡ Agentic RAG Knowledge Assistant
              <span style={{
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: '#fff', fontSize: '0.6rem', padding: '2px 8px',
                borderRadius: 20, fontWeight: 700, letterSpacing: '0.05em',
              }}>GROQ POWERED</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
              {docs.length} docs · LLaMA 3.3 70B · Ultra-fast responses
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {apiKeySaved ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: '#dcfce7', border: '1px solid #bbf7d0',
                borderRadius: 20, padding: '4px 12px', fontSize: '0.7rem', color: '#16a34a', fontWeight: 700,
              }}>
                <span style={{ animation: 'pulse 2s infinite' }}>●</span> Ready
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: '#fef9c3', border: '1px solid #fde047',
                borderRadius: 20, padding: '4px 12px', fontSize: '0.7rem', color: '#a16207', fontWeight: 700,
              }}>⚠ No API Key</div>
            )}
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); setError('') }} className="icon-btn"
                style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b',
                  fontSize: '0.75rem', padding: '0.3rem 0.85rem', borderRadius: 8, cursor: 'pointer', fontWeight: 500,
                }}>Clear</button>
            )}
          </div>
        </div>

        {/* Chat */}
        <div ref={chatRef} style={{
          flex: 1, overflowY: 'auto', padding: '1.75rem 2rem',
          display: 'flex', flexDirection: 'column', gap: '1.25rem',
          background: '#f8faff',
        }}>

          {/* Empty state */}
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '1.5rem', animation: 'fadeIn 0.5s ease' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 22, margin: '0 auto 1rem',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
                boxShadow: '0 8px 32px rgba(37,99,235,0.3)',
              }}>⚡</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.4rem' }}>
                Lightning-fast answers
              </div>
              <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Powered by Groq LPU — responses in <strong style={{ color: '#2563eb' }}>1-3 seconds</strong>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '2rem' }}>
                {apiKeySaved
                  ? `${docs.length} documents ready · Ask anything`
                  : '👈 Add your free Groq API key to get started'}
              </div>

              {/* Feature pills */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                {['⚡ ~1-3s response', '🆓 Free API', '🧠 LLaMA 3.3 70B', '📄 RAG enabled'].map(f => (
                  <span key={f} style={{
                    background: 'white', border: '1px solid #e0e7ff', color: '#475569',
                    fontSize: '0.75rem', padding: '0.35rem 0.85rem', borderRadius: 20, fontWeight: 500,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  }}>{f}</span>
                ))}
              </div>

              {/* Suggestions */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', maxWidth: 500, margin: '0 auto' }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)} className="chip"
                    style={{
                      background: 'white', border: '1px solid #e0e7ff', color: '#475569',
                      padding: '0.55rem 1rem', borderRadius: 20, fontSize: '0.8rem',
                      cursor: 'pointer', transition: 'all 0.2s', fontWeight: 500,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <div key={msg.id} className="msg-in" style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 10, alignItems: 'flex-start',
            }}>
              {msg.role === 'assistant' && (
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                }}>⚡</div>
              )}
              <div style={{ maxWidth: '72%' }}>
                {msg.role === 'assistant' && (
                  <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 500 }}>Groq · LLaMA 3.3</span>
                    <SpeedBadge ms={msg.elapsed} />
                  </div>
                )}
                <div style={{
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #2563eb, #7c3aed)'
                    : 'white',
                  border: msg.role === 'user' ? 'none' : '1px solid #e0e7ff',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                  padding: '0.85rem 1.1rem', fontSize: '0.875rem',
                  color: msg.role === 'user' ? '#fff' : '#334155',
                  boxShadow: msg.role === 'user'
                    ? '0 4px 16px rgba(37,99,235,0.3)'
                    : '0 2px 10px rgba(0,0,0,0.05)',
                  lineHeight: 1.65,
                }}>
                  {msg.role === 'assistant' ? renderText(msg.content) : msg.content}
                </div>
              </div>
              {msg.role === 'user' && (
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                }}>👤</div>
              )}
            </div>
          ))}

          {/* Typing */}
          {loading && (
            <div className="msg-in" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
              }}>⚡</div>
              <div style={{
                background: 'white', border: '1px solid #e0e7ff',
                borderRadius: '4px 18px 18px 18px', padding: '0.85rem 1.2rem',
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{
                      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                      background: '#2563eb', animation: 'bounce 1.2s infinite',
                      animationDelay: `${i * 0.15}s`,
                    }}/>
                  ))}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Processing at lightning speed...</span>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 12,
              padding: '0.85rem 1.1rem', color: '#dc2626', fontSize: '0.85rem',
              animation: 'fadeIn 0.3s ease',
            }}>⚠️ {error}</div>
          )}
        </div>

        {/* Input */}
        <div style={{
          padding: '0.85rem 1.5rem 1rem', borderTop: '1px solid #e0e7ff',
          background: 'white', flexShrink: 0,
        }}>
          {messages.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', marginBottom: '0.65rem', paddingBottom: 2 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} className="chip"
                  style={{
                    background: '#f8fbff', border: '1px solid #e0e7ff', color: '#64748b',
                    padding: '0.35rem 0.85rem', borderRadius: 20, fontSize: '0.73rem',
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.2s', fontWeight: 500,
                  }}>{s}</button>
              ))}
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: '0.6rem',
            background: '#f8faff', border: '1.5px solid #e0e7ff',
            borderRadius: 16, padding: '0.65rem 0.75rem',
            boxShadow: '0 4px 16px rgba(37,99,235,0.07)',
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px'
              }}
              placeholder="Ask anything — answers in seconds..."
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#1e293b', fontSize: '0.9rem', resize: 'none',
                lineHeight: 1.5, fontFamily: 'inherit', maxHeight: 130,
              }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading} className="send-btn"
              style={{
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg, #2563eb, #7c3aed)'
                  : '#f1f5f9',
                border: 'none',
                color: input.trim() && !loading ? '#fff' : '#cbd5e1',
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', transition: 'all 0.2s',
                boxShadow: input.trim() && !loading ? '0 4px 12px rgba(37,99,235,0.35)' : 'none',
              }}>➤</button>
          </div>
          <p style={{ fontSize: '0.63rem', color: '#c7d2fe', textAlign: 'center', marginTop: '0.4rem' }}>
            ⚡ Groq LPU · LLaMA 3.3 70B · ~1-3s · Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
