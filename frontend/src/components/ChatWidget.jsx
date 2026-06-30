import { useState, useRef, useEffect } from "react";
import { FiMessageSquare, FiX, FiSend } from "react-icons/fi";
import { streamChat } from "../api/agent";

const TOOL_LABELS = {
  add_expense: "Logging expense…",
  get_monthly_summary: "Checking your spending…",
  get_recent_expenses: "Reading transactions…",
  get_portfolio_summary: "Reading your portfolio…",
  get_goals: "Checking your goals…",
  get_holdings: "Reading holdings…",
  get_sips: "Reading SIPs…",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role, content}
  const [input, setInput] = useState("");
  const [status, setStatus] = useState(""); // tool status line
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const history = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]); // empty bubble to fill
    setInput("");
    setBusy(true);
    setStatus("");

    const appendToken = (t) =>
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: copy[copy.length - 1].content + t,
        };
        return copy;
      });

    try {
      await streamChat(text, history.slice(-8), {
        onToken: (t) => {
          setStatus("");
          appendToken(t);
        },
        onTool: (name) => setStatus(TOOL_LABELS[name] || "Working…"),
        onDone: () => setStatus(""),
      });
    } catch {
      appendToken("\n(Something went wrong — try again.)");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 shadow-lg transition hover:scale-105"
        title="Ask FinCA"
      >
        <FiMessageSquare size={20} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[380px] flex-col rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <span className="text-[13px] font-medium text-zinc-100">FinCA Assistant</span>
        <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-200">
          <FiX size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-[13px] text-zinc-500">
            Try “Log ₹500 for groceries”, “Am I over budget?”, or “How are my goals doing?”
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                "max-w-[80%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] " +
                (m.role === "user" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-100")
              }
            >
              {m.content || "…"}
            </div>
          </div>
        ))}
        {status && <div className="text-[13px] italic text-zinc-500">{status}</div>}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-zinc-800 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask FinCA…"
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[13px] text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
        />
        <button
          onClick={send}
          disabled={busy}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 disabled:opacity-50"
        >
          <FiSend size={15} />
        </button>
      </div>
    </div>
  );
}
