import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/landing-chat`;

async function streamChat({ messages, onDelta, onDone, onError }: { messages: Msg[]; onDelta: (t: string) => void; onDone: () => void; onError: (msg: string) => void }) {
  let resp: Response;
  try {
    resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ messages }),
    });
  } catch {
    onError("error");
    return;
  }
  if (!resp.ok) { try { const err = await resp.json(); onError(err.error || "error"); } catch { onError("error"); } return; }
  if (!resp.body) { onError("empty"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;
  while (!done) {
    const { done: rd, value } = await reader.read();
    if (rd) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const parsed = JSON.parse(json);
        const c = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (c) onDelta(c);
      } catch { buf = line + "\n" + buf; break; }
    }
  }
  onDone();
}

export function AIChatWidget() {
  const { lang } = useLandingLang();
  const tr = t[lang];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setShowQuick(false);
    setLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((p) => {
        const last = p[p.length - 1];
        if (last?.role === "assistant") return p.map((m, i) => (i === p.length - 1 ? { ...m, content: assistantSoFar } : m));
        return [...p, { role: "assistant", content: assistantSoFar }];
      });
    };

    await streamChat({
      messages: [...messages, userMsg],
      onDelta: upsert,
      onDone: () => setLoading(false),
      onError: (msg) => {
        const errorMsg = msg === "error" ? tr.chatErrorProcess : msg === "empty" ? tr.chatErrorEmpty : tr.chatErrorConnect;
        setMessages((p) => [...p, { role: "assistant", content: `⚠️ ${errorMsg}` }]);
        setLoading(false);
      },
    });
  };

  return (
    <>
      <button onClick={() => setOpen(!open)} className="fixed bottom-6 right-6 z-50 bg-accent text-accent-foreground w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform" aria-label={tr.chatLabel}>
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-[340px] sm:w-[380px] max-h-[520px] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-accent text-accent-foreground px-4 py-3 flex items-center gap-2 shrink-0">
            <MessageCircle size={18} />
            <span className="font-semibold text-sm">{tr.chatTitle}</span>
          </div>

          <ScrollArea className="flex-1 min-h-0 px-3 py-2">
            {messages.length === 0 && (
              <p className="text-muted-foreground text-xs text-center mt-4 mb-2">{tr.chatGreeting}</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`mb-2 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`text-sm px-3 py-2 rounded-lg max-w-[85%] whitespace-pre-wrap ${m.role === "user" ? "bg-accent text-accent-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start mb-2">
                <div className="bg-muted text-foreground text-sm px-3 py-2 rounded-lg rounded-bl-sm flex items-center gap-1">
                  <Loader2 size={14} className="animate-spin" />
                  <span>{tr.chatTyping}</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </ScrollArea>

          {showQuick && messages.length === 0 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {tr.chatQuickOptions.map((o) => (
                <button key={o.label} onClick={() => send(o.text)} className="text-xs bg-accent/10 text-accent hover:bg-accent/20 px-2.5 py-1.5 rounded-full transition-colors border border-accent/20">
                  {o.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t px-3 py-2 flex gap-2 shrink-0">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={tr.chatPlaceholder} className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground" disabled={loading} />
            <Button type="submit" size="icon" variant="ghost" disabled={loading || !input.trim()} className="shrink-0">
              <Send size={16} />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
