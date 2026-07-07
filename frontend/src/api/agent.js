import api from "./axios";

// One-shot AI portfolio review for the Investments page (educational cards).
export const getPortfolioReview = () =>
  api.get("/agents/portfolio-review").then((r) => r.data);

// Streaming client for the FinCA chat agent. Uses fetch (not axios) because the
// response is a Server-Sent Events stream we read chunk-by-chunk.
export async function streamChat(message, history, { onToken, onTool, onDone }) {
  const token = localStorage.getItem("access_token");
  const res = await fetch("http://localhost:8000/api/v1/agents/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    credentials: "include",
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok || !res.body) throw new Error(`stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop(); // keep the trailing partial event for the next chunk
    for (const part of parts) {
      const line = part.replace(/^data: /, "").trim();
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.type === "token") onToken(ev.text);
      else if (ev.type === "tool") onTool(ev.name);
      else if (ev.type === "done") onDone?.();
    }
  }
}
