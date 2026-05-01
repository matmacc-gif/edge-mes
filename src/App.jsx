import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are an elite MES/ES futures day trading coach and analyst for Matt, a momentum day trader on a TopStep $50k funded account.

MATT'S SYSTEM — THE BREAK + RETEST SYSTEM:
Entry requires ALL 5 conditions simultaneously:
1. 15-min bias established (EMA stack direction, price above/below session VWAP)
2. Price at a pre-planned key level (not chasing)
3. Break + retest confirmed on 5-min chart
4. Volume confirms the break (above 20-bar MA)
5. FVG or EMA confluence at entry zone

INDICATOR STACK: Anchored VWAP (session), 9 EMA + 21 EMA, Volume with 20-bar MA, RSI (14) for divergence only, Volume Profile (POC/VAH/VAL)

TRADE MANAGEMENT:
- Scale out 50–75% at T1, move stop to breakeven, runner to T2
- Max stop: 5–6 points
- Max risk per trade: $300–$400
- Daily loss limit: $1,000 hard stop
- Step away after 2 consecutive losers
- NO trades through news events
- Limit orders only at the retest — never market orders
- Minimum 2:1 R:R required

TOPSTEP $50K PARAMETERS:
- Trading MES at 3–5 contracts per trade
- Each MES point = $5
- 5-point stop on 5 contracts = $125 risk
- 5-point stop on 10 contracts = $250 risk



YOUR ROLE:
- Be a direct, no-nonsense trading coach
- Always validate against Matt's 5-condition checklist
- Call out rule violations (chasing, market orders, trading through news)
- For chart analysis: evaluate all 5 conditions, state bias, give specific entry/stop/target levels
- For daily brief: provide Globex action, key levels, bias, bull/bear scenarios, catalysts
- Never give vague answers — be specific with price levels
- Reinforce discipline over impulsive entries
- Trust Matt's level analysis, focus on condition confirmation`;



// --- Fetch delayed ES price from Polygon.io (free tier) ---
async function fetchESPrice(apiKey) {
  if (!apiKey) return null;
  try {
    // Polygon free tier: delayed snapshot for futures
    const res = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/futures/tickers/ESM26?apiKey=${apiKey}`
    );
    const data = await res.json();
    return data?.results?.day?.c ?? data?.results?.lastTrade?.p ?? null;
  } catch {
    return null;
  }
}

// --- Call Claude API ---
async function callClaude(messages, systemOverride) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: systemOverride || SYSTEM_PROMPT,
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? "No response received.";
}

// --- Convert image file to base64 ---
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
// COMPONENTS
// ============================================================

function PriceBar({ price, setPrice, isLive, lastUpdated }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    const val = parseFloat(draft);
    if (!isNaN(val) && val > 0) setPrice(val);
    setEditing(false);
    setDraft("");
  }

  function onKey(e) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setEditing(false); setDraft(""); }
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "16px",
      padding: "8px 20px", background: "#0d0d0d",
      borderBottom: "1px solid #1a1a1a", fontFamily: "'JetBrains Mono', monospace"
    }}>
      <span style={{ color: "#555", fontSize: "11px", letterSpacing: "2px" }}>ESM26</span>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          placeholder="e.g. 7134.50"
          style={{
            background: "transparent", border: "none", borderBottom: "1px solid #e0b84a",
            color: "#e0b84a", fontFamily: "'JetBrains Mono', monospace",
            fontSize: "20px", fontWeight: "700", width: "130px", outline: "none", padding: "0"
          }}
        />
      ) : (
        <span
          onClick={() => { setEditing(true); setDraft(price ? price.toString() : ""); }}
          title="Click to override price"
          style={{
            color: price ? "#fff" : "#333", fontSize: "20px", fontWeight: "700",
            cursor: "text", paddingBottom: "1px",
            borderBottom: price ? "none" : "1px dashed #333"
          }}
        >
          {price ? price.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
        </span>
      )}

      <span style={{
        fontSize: "10px", letterSpacing: "1px", padding: "2px 6px", borderRadius: "3px",
        background: isLive ? "#0d2e1a" : "#1a1a0a",
        color: isLive ? "#26a69a" : "#888",
        border: `1px solid ${isLive ? "#1a4a2a" : "#2a2a1a"}`
      }}>
        {isLive ? "15-MIN DELAYED" : "MANUAL"}
      </span>

      {lastUpdated && (
        <span style={{ color: "#333", fontSize: "10px" }}>
          updated {lastUpdated}
        </span>
      )}

      <span style={{ marginLeft: "auto", color: "#444", fontSize: "10px", letterSpacing: "1px" }}>
        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ET
      </span>
    </div>
  );
}

function MarkdownText({ text }) {
  const lines = text.split("\n");
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", lineHeight: "1.8", color: "#ccc" }}>
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <div key={i} style={{ color: "#e0b84a", fontWeight: "700", fontSize: "14px", marginTop: "18px", marginBottom: "6px", letterSpacing: "1px" }}>{line.replace("## ", "")}</div>;
        if (line.startsWith("# ")) return <div key={i} style={{ color: "#e0b84a", fontWeight: "700", fontSize: "16px", marginTop: "20px", marginBottom: "8px" }}>{line.replace("# ", "")}</div>;
        if (line.startsWith("**") && line.endsWith("**")) return <div key={i} style={{ color: "#fff", fontWeight: "700", marginTop: "8px" }}>{line.replace(/\*\*/g, "")}</div>;
        if (line.startsWith("- ") || line.startsWith("• ")) return <div key={i} style={{ paddingLeft: "16px", color: "#bbb" }}>→ {line.slice(2)}</div>;
        if (line.startsWith("✅")) return <div key={i} style={{ color: "#26a69a" }}>{line}</div>;
        if (line.startsWith("❌")) return <div key={i} style={{ color: "#ef5350" }}>{line}</div>;
        if (line.startsWith("⚠️")) return <div key={i} style={{ color: "#e0b84a" }}>{line}</div>;
        if (line.startsWith("---")) return <hr key={i} style={{ border: "none", borderTop: "1px solid #222", margin: "12px 0" }} />;
        if (line.trim() === "") return <div key={i} style={{ height: "8px" }} />;
        // Bold inline
        const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <div key={i}>
            {boldParts.map((p, j) =>
              p.startsWith("**") ? <strong key={j} style={{ color: "#fff" }}>{p.replace(/\*\*/g, "")}</strong> : p
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// DAILY BRIEF TAB
// ============================================================
function DailyBriefTab({ esPrice }) {
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateBrief() {
    setLoading(true);
    setBrief("");
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const priceNote = esPrice ? `Current ESM26 price: ${esPrice.toFixed(2)}` : "Live price unavailable — use your platform price.";
    const prompt = `Generate a complete pre-market trading brief for today, ${today}. ${priceNote}

Include:
1. Overnight Globex action summary
2. Key levels table (resistance, pivot, support zones) anchored to current price
3. Intraday bias (bull/bear/neutral) with reasoning
4. Bull scenario trade plan (trigger, entry zone, T1, T2, stop)
5. Bear scenario trade plan (trigger, entry zone, T1, T2, stop)
6. News/catalysts to watch today with specific trade implications
7. Risk management reminders for today's specific conditions

Be specific with price levels. Format clearly with headers.`;

    try {
      const result = await callClaude([{ role: "user", content: prompt }]);
      setBrief(result);
    } catch (e) {
      setBrief("Error generating brief. Check your API connection.");
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: "24px", maxWidth: "900px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ color: "#e0b84a", fontSize: "11px", letterSpacing: "3px", fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>DAILY INTELLIGENCE</div>
          <div style={{ color: "#fff", fontSize: "22px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
        </div>
        <button onClick={generateBrief} disabled={loading} style={{
          background: loading ? "#1a1a1a" : "linear-gradient(135deg, #e0b84a, #c49a2a)",
          color: loading ? "#555" : "#000",
          border: "none", borderRadius: "4px", padding: "12px 28px",
          fontFamily: "'JetBrains Mono', monospace", fontSize: "12px",
          fontWeight: "700", letterSpacing: "2px", cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.2s"
        }}>
          {loading ? "GENERATING..." : "GENERATE BRIEF"}
        </button>
      </div>

      {!brief && !loading && (
        <div style={{
          border: "1px dashed #222", borderRadius: "8px", padding: "60px",
          textAlign: "center", color: "#444", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px"
        }}>
          Click "Generate Brief" to pull today's pre-market intelligence
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#e0b84a", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", padding: "40px" }}>
          <div style={{ width: "8px", height: "8px", background: "#e0b84a", borderRadius: "50%", animation: "pulse 1s infinite" }} />
          Analyzing market conditions...
        </div>
      )}

      {brief && (
        <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: "8px", padding: "28px" }}>
          <MarkdownText text={brief} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// CHART ANALYSIS TAB
// ============================================================
function ChartAnalysisTab() {
  const [image, setImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const fileRef = useRef();
  const dropRef = useRef();

  async function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setImage(url);
    const b64 = await fileToBase64(file);
    setImageData({ data: b64, mediaType: file.type });
    setAnalysis("");
  }

  function onDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }

  async function analyzeChart() {
    if (!imageData) return;
    setLoading(true);
    setAnalysis("");
    const notesText = notes.trim() ? `\n\nAdditional context from trader: ${notes}` : "";
    try {
      const result = await callClaude([{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: imageData.mediaType, data: imageData.data } },
          { type: "text", text: `Analyze this ESM26/MES chart using my Break + Retest System. Evaluate all 5 entry conditions explicitly. Give me:

1. **CHECKLIST** — go through each of the 5 conditions (✅ or ❌ with reasoning)
2. **BIAS** — 15-min directional bias based on EMA stack and VWAP
3. **KEY LEVELS** — resistance, pivot, support visible on this chart with exact prices
4. **TRADE CALL** — Long / Short / No Trade right now and why
5. **IF TRADE EXISTS** — Entry zone, Stop (exact points), T1, T2, R:R ratio, contract sizing recommendation (3 or 5 MES)
6. **RISK FLAGS** — anything that violates system rules or increases risk${notesText}` }
        ]
      }]);
      setAnalysis(result);
    } catch (e) {
      setAnalysis("Error analyzing chart. Check API connection.");
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: "24px", maxWidth: "900px" }}>
      <div style={{ color: "#e0b84a", fontSize: "11px", letterSpacing: "3px", fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>CHART ANALYSIS</div>
      <div style={{ color: "#fff", fontSize: "22px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace", marginBottom: "24px" }}>Break + Retest Evaluator</div>

      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current.click()}
        style={{
          border: image ? "1px solid #333" : "2px dashed #333",
          borderRadius: "8px", cursor: "pointer",
          minHeight: image ? "auto" : "160px",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "16px", overflow: "hidden", transition: "border 0.2s",
          background: "#0a0a0a"
        }}
      >
        {image
          ? <img src={image} alt="chart" style={{ width: "100%", display: "block", borderRadius: "8px" }} />
          : <div style={{ textAlign: "center", color: "#444", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>📊</div>
              Drop chart screenshot here or click to upload
            </div>
        }
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />

      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Optional: Add context (e.g. 'price just rejected 7143 twice' or 'looking at potential short')"
        style={{
          width: "100%", background: "#0d0d0d", border: "1px solid #222",
          borderRadius: "4px", color: "#ccc", fontFamily: "'JetBrains Mono', monospace",
          fontSize: "12px", padding: "12px", resize: "vertical", minHeight: "60px",
          marginBottom: "12px", boxSizing: "border-box"
        }}
      />

      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <button onClick={analyzeChart} disabled={!imageData || loading} style={{
          background: imageData && !loading ? "linear-gradient(135deg, #e0b84a, #c49a2a)" : "#1a1a1a",
          color: imageData && !loading ? "#000" : "#555",
          border: "none", borderRadius: "4px", padding: "12px 28px",
          fontFamily: "'JetBrains Mono', monospace", fontSize: "12px",
          fontWeight: "700", letterSpacing: "2px", cursor: imageData && !loading ? "pointer" : "not-allowed"
        }}>
          {loading ? "ANALYZING..." : "ANALYZE CHART"}
        </button>
        {image && (
          <button onClick={() => { setImage(null); setImageData(null); setAnalysis(""); setNotes(""); }} style={{
            background: "transparent", color: "#555", border: "1px solid #222",
            borderRadius: "4px", padding: "12px 20px",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", cursor: "pointer"
          }}>CLEAR</button>
        )}
      </div>

      {loading && (
        <div style={{ color: "#e0b84a", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", padding: "20px 0", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "8px", height: "8px", background: "#e0b84a", borderRadius: "50%", animation: "pulse 1s infinite" }} />
          Running 5-condition checklist...
        </div>
      )}

      {analysis && (
        <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: "8px", padding: "28px" }}>
          <MarkdownText text={analysis} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// LIVE COACHING TAB
// ============================================================
function LiveCoachingTab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const result = await callClaude(newMessages);
      setMessages([...newMessages, { role: "assistant", content: result }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Connection error. Try again." }]);
    }
    setLoading(false);
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)", padding: "24px", maxWidth: "900px" }}>
      <div style={{ color: "#e0b84a", fontSize: "11px", letterSpacing: "3px", fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>LIVE COACHING</div>
      <div style={{ color: "#fff", fontSize: "22px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace", marginBottom: "16px" }}>Intraday Assistant</div>

      <div style={{ flex: 1, overflowY: "auto", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {messages.length === 0 && (
          <div style={{ color: "#333", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", padding: "40px", textAlign: "center" }}>
            Your system is pre-loaded. Ask anything — "Should I enter short here?", "Is my bias valid?", "Check my 5 conditions..."
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", padding: "14px 18px", borderRadius: "8px",
              background: m.role === "user" ? "#1a1a0d" : "#0d0d0d",
              border: m.role === "user" ? "1px solid #3a3010" : "1px solid #1e1e1e",
            }}>
              {m.role === "user"
                ? <div style={{ color: "#e0b84a", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}>{m.content}</div>
                : <MarkdownText text={m.content} />
              }
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#e0b84a", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", padding: "8px" }}>
            <div style={{ width: "6px", height: "6px", background: "#e0b84a", borderRadius: "50%", animation: "pulse 0.8s infinite" }} />
            <div style={{ width: "6px", height: "6px", background: "#e0b84a", borderRadius: "50%", animation: "pulse 0.8s infinite 0.2s" }} />
            <div style={{ width: "6px", height: "6px", background: "#e0b84a", borderRadius: "50%", animation: "pulse 0.8s infinite 0.4s" }} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask your coach... (Enter to send, Shift+Enter for newline)"
          rows={2}
          style={{
            flex: 1, background: "#0d0d0d", border: "1px solid #222", borderRadius: "4px",
            color: "#ccc", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px",
            padding: "12px", resize: "none", outline: "none"
          }}
        />
        <button onClick={send} disabled={loading || !input.trim()} style={{
          background: input.trim() && !loading ? "linear-gradient(135deg, #e0b84a, #c49a2a)" : "#1a1a1a",
          color: input.trim() && !loading ? "#000" : "#555",
          border: "none", borderRadius: "4px", padding: "0 20px",
          fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
          fontWeight: "700", letterSpacing: "2px", cursor: input.trim() && !loading ? "pointer" : "not-allowed"
        }}>SEND</button>
      </div>
    </div>
  );
}

// ============================================================
// TRADE LOG TAB
// ============================================================
function TradeLogTab() {
  const [trades, setTrades] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tradeLog") || "[]"); } catch { return []; }
  });
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], symbol: "MES", direction: "Long", contracts: "3", notes: "", outcome: "Win" });
  const [showForm, setShowForm] = useState(false);

  function saveTrades(updated) {
    setTrades(updated);
    try { localStorage.setItem("tradeLog", JSON.stringify(updated)); } catch {}
  }

  function addTrade() {
    if (!form.notes.trim()) return;
    saveTrades([{ ...form, id: Date.now() }, ...trades]);
    setForm({ date: new Date().toISOString().split("T")[0], symbol: "MES", direction: "Long", contracts: "3", notes: "", outcome: "Win" });
    setShowForm(false);
  }

  function deleteTrade(id) {
    saveTrades(trades.filter(t => t.id !== id));
  }

  const wins = trades.filter(t => t.outcome === "Win").length;
  const losses = trades.filter(t => t.outcome === "Loss").length;
  const winRate = trades.length ? Math.round((wins / trades.length) * 100) : 0;

  const inputStyle = {
    background: "#0d0d0d", border: "1px solid #222", borderRadius: "4px",
    color: "#ccc", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px",
    padding: "8px 10px", outline: "none"
  };

  return (
    <div style={{ padding: "24px", maxWidth: "900px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ color: "#e0b84a", fontSize: "11px", letterSpacing: "3px", fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>TRADE LOG</div>
          <div style={{ color: "#fff", fontSize: "22px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace" }}>Session Journal</div>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          background: "linear-gradient(135deg, #e0b84a, #c49a2a)", color: "#000",
          border: "none", borderRadius: "4px", padding: "10px 20px",
          fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
          fontWeight: "700", letterSpacing: "2px", cursor: "pointer"
        }}>+ LOG TRADE</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "TOTAL TRADES", value: trades.length, color: "#fff" },
          { label: "WIN RATE", value: `${winRate}%`, color: winRate >= 60 ? "#26a69a" : winRate >= 50 ? "#e0b84a" : "#ef5350" },
          { label: "W / L", value: `${wins} / ${losses}`, color: "#888" },
        ].map(s => (
          <div key={s.label} style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: "6px", padding: "16px" }}>
            <div style={{ color: "#444", fontSize: "10px", letterSpacing: "2px", fontFamily: "'JetBrains Mono', monospace", marginBottom: "6px" }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: "24px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: "#0d0d0d", border: "1px solid #2a2a1a", borderRadius: "8px", padding: "20px", marginBottom: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ color: "#555", fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px" }}>DATE</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ color: "#555", fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px" }}>DIRECTION</label>
              <select value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })} style={inputStyle}>
                <option>Long</option><option>Short</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ color: "#555", fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px" }}>CONTRACTS</label>
              <select value={form.contracts} onChange={e => setForm({ ...form, contracts: e.target.value })} style={inputStyle}>
                <option>3</option><option>4</option><option>5</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ color: "#555", fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px" }}>OUTCOME</label>
              <select value={form.outcome} onChange={e => setForm({ ...form, outcome: e.target.value })} style={inputStyle}>
                <option>Win</option><option>Loss</option><option>BE</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ color: "#555", fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px" }}>&nbsp;</label>
              <button onClick={addTrade} style={{
                background: "linear-gradient(135deg, #e0b84a, #c49a2a)", color: "#000",
                border: "none", borderRadius: "4px", padding: "8px",
                fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
                fontWeight: "700", cursor: "pointer"
              }}>SAVE</button>
            </div>
          </div>
          <textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Trade notes: setup, execution quality, what worked / what didn't..."
            rows={3}
            style={{ ...inputStyle, width: "100%", resize: "vertical", boxSizing: "border-box" }}
          />
        </div>
      )}

      {/* Trade list */}
      {trades.length === 0 && !showForm && (
        <div style={{ border: "1px dashed #222", borderRadius: "8px", padding: "60px", textAlign: "center", color: "#444", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}>
          No trades logged yet. Hit "+ Log Trade" after each session.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {trades.map(t => (
          <div key={t.id} style={{
            background: "#0d0d0d", border: `1px solid ${t.outcome === "Win" ? "#1a2e1a" : t.outcome === "Loss" ? "#2e1a1a" : "#2a2a1a"}`,
            borderRadius: "6px", padding: "16px", display: "flex", gap: "16px", alignItems: "flex-start"
          }}>
            <div style={{
              width: "42px", height: "42px", borderRadius: "4px", flexShrink: 0,
              background: t.outcome === "Win" ? "#26a69a22" : t.outcome === "Loss" ? "#ef535022" : "#44444422",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: t.outcome === "Win" ? "#26a69a" : t.outcome === "Loss" ? "#ef5350" : "#888",
              fontSize: "18px"
            }}>
              {t.outcome === "Win" ? "✓" : t.outcome === "Loss" ? "✗" : "—"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: "12px", marginBottom: "6px", flexWrap: "wrap" }}>
                <span style={{ color: "#e0b84a", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>{t.date}</span>
                <span style={{ color: t.direction === "Long" ? "#26a69a" : "#ef5350", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>{t.direction.toUpperCase()}</span>
                <span style={{ color: "#666", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>{t.contracts} contracts</span>
              </div>
              <div style={{ color: "#999", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", lineHeight: "1.6" }}>{t.notes}</div>
            </div>
            <button onClick={() => deleteTrade(t.id)} style={{
              background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: "16px", padding: "0 4px"
            }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}



// ============================================================
// SETTINGS MODAL
// ============================================================
function SettingsModal({ onClose, polygonKey, setPolygonKey }) {
  const [val, setVal] = useState(polygonKey);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{ background: "#0d0d0d", border: "1px solid #2a2a1a", borderRadius: "10px", padding: "32px", width: "480px" }}>
        <div style={{ color: "#e0b84a", fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", fontWeight: "700", marginBottom: "20px", letterSpacing: "2px" }}>API CONFIGURATION</div>
        <div style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", marginBottom: "20px", lineHeight: "1.8" }}>
          Sign up free at <span style={{ color: "#e0b84a" }}>polygon.io</span> → Dashboard → API Keys.<br />
          Free tier provides 15-minute delayed futures quotes, refreshed every 60 seconds.
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ color: "#444", fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "2px", display: "block", marginBottom: "8px" }}>POLYGON.IO API KEY</label>
          <input
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder="Paste your API key here..."
            style={{
              width: "100%", background: "#050505", border: "1px solid #222",
              borderRadius: "4px", color: "#ccc", fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px", padding: "10px 12px", boxSizing: "border-box", outline: "none"
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => { setPolygonKey(val); onClose(); }} style={{
            background: "linear-gradient(135deg, #e0b84a, #c49a2a)", color: "#000",
            border: "none", borderRadius: "4px", padding: "10px 24px",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
            fontWeight: "700", letterSpacing: "2px", cursor: "pointer"
          }}>SAVE</button>
          <button onClick={onClose} style={{
            background: "transparent", color: "#555", border: "1px solid #222",
            borderRadius: "4px", padding: "10px 20px",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", cursor: "pointer"
          }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function TradingAssistant() {
  const [tab, setTab] = useState("brief");
  const [esPrice, setEsPrice] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [polygonKey, setPolygonKey] = useState(() => {
    try { return localStorage.getItem("polygonKey") || ""; } catch { return ""; }
  });
  const [showSettings, setShowSettings] = useState(false);

  // Persist key
  useEffect(() => {
    try { localStorage.setItem("polygonKey", polygonKey); } catch {}
  }, [polygonKey]);

  // Poll price every 60s when key exists
  useEffect(() => {
    if (!polygonKey) return;
    async function update() {
      const p = await fetchESPrice(polygonKey);
      if (p) {
        setEsPrice(p);
        setIsLive(true);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
    }
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [polygonKey]);

  const tabs = [
    { id: "brief", label: "DAILY BRIEF" },
    { id: "chart", label: "CHART ANALYSIS" },
    { id: "coaching", label: "LIVE COACHING" },
    { id: "log", label: "TRADE LOG" },
  ];

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#ccc" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #080808; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
        textarea:focus, input:focus { border-color: #3a3010 !important; }
      `}</style>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 24px", borderBottom: "1px solid #111", background: "#050505"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "28px", height: "28px", background: "linear-gradient(135deg, #e0b84a, #c49a2a)",
            borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: "900", color: "#000", fontFamily: "'JetBrains Mono', monospace"
          }}>M</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: "#fff", fontWeight: "700", fontSize: "14px", letterSpacing: "1px" }}>
            EDGE <span style={{ color: "#e0b84a" }}>//</span> MES
          </div>
          <div style={{ color: "#333", fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>TopStep $50K</div>
        </div>
        <button onClick={() => setShowSettings(true)} style={{
          background: "transparent", border: "1px solid #222", borderRadius: "4px",
          color: polygonKey ? "#e0b84a" : "#555",
          fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
          letterSpacing: "2px", padding: "6px 14px", cursor: "pointer"
        }}>⚙ {polygonKey ? "API ✓" : "API KEY"}</button>
      </div>

      <PriceBar
        price={esPrice}
        setPrice={p => { setEsPrice(p); setIsLive(false); }}
        isLive={isLive}
        lastUpdated={lastUpdated}
      />

      {/* Nav */}
      <div style={{ display: "flex", borderBottom: "1px solid #111", background: "#050505", paddingLeft: "24px" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "transparent", border: "none",
            borderBottom: tab === t.id ? "2px solid #e0b84a" : "2px solid transparent",
            color: tab === t.id ? "#e0b84a" : "#444",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "2px",
            padding: "14px 20px", cursor: "pointer", transition: "all 0.15s"
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ overflowY: "auto" }}>
        {tab === "brief" && <DailyBriefTab esPrice={esPrice} />}
        {tab === "chart" && <ChartAnalysisTab />}
        {tab === "coaching" && <LiveCoachingTab />}
        {tab === "log" && <TradeLogTab />}
      </div>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          polygonKey={polygonKey}
          setPolygonKey={setPolygonKey}
        />
      )}
    </div>
  );
}
