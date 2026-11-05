import { useContext, useEffect, useRef, useState } from "react";
import { ArrowUp, Plus, Loader2 } from "lucide-react";
import { AccountContext } from "../core/Auth";
import { api } from "../core/bridge";
import { BrandMark } from "./BrandMark";
type Message = { role: "user" | "assistant"; content: string };
export function Chat() {
  const account = useContext(AccountContext),
    key = `corelum.chat.${account?.id || "unknown"}.v1`;
  const [messages, setMessages] = useState<Message[]>(() => {
      try {
        return JSON.parse(localStorage.getItem(key) || "[]");
      } catch {
        return [];
      }
    }),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const tail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(messages.slice(-60)));
    } catch {
      setError("Conversation could not be saved on this device.");
    }
    tail.current?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });
  }, [messages, busy, key]);
  const send = async (value = text) => {
    if (!value.trim() || busy) return;
    const next: Message[] = [
      ...messages,
      { role: "user", content: value.trim() },
    ];
    setMessages(next);
    setText("");
    setError("");
    setBusy(true);
    try {
      let count = 0;
      const context: Message[] = [];
      for (const item of next.slice(-18).reverse()) {
        count += item.content.length;
        if (count > 15000) break;
        context.unshift(item);
      }
      const response = await api<{ reply: string }>("/chat", "POST", {
        messages: context,
      });
      setMessages([...next, { role: "assistant", content: response.reply }]);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="chat-page">
      <div className="chat-heading">
        <h1>Workspace</h1>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            setMessages([]);
            setError("");
          }}
        >
          <Plus size={15} />
          New chat
        </button>
      </div>
      <section className="chat-surface">
        <div className="chat-messages" aria-live="polite">
          {!messages.length ? (
            <div className="chat-empty">
              <BrandMark size={48} />
              <h2>How can I help today?</h2>
              <p>Ask a question or tell me what you’re working on.</p>
              <div className="suggestions">
                {[
                  "Help me plan my day",
                  "Explain a topic clearly",
                  "Help me write a message",
                ].map((t) => (
                  <button className="secondary" key={t} onClick={() => send(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, i) => (
              <article key={i} className={`chat-message ${message.role}`}>
                <div className="message-avatar">
                  {message.role === "assistant" ? (
                    <BrandMark size={20} />
                  ) : (
                    account?.username.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="message-copy">
                  <strong>
                    {message.role === "assistant" ? "Corelum AI" : "You"}
                  </strong>
                  <div>{message.content}</div>
                </div>
              </article>
            ))
          )}
          {busy && (
            <div className="chat-message assistant">
              <div className="message-avatar">
                <BrandMark size={20} />
              </div>
              <div className="typing-dots" aria-label="Generating reply">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
          <div ref={tail} />
        </div>
        {error && (
          <div className="chat-error" role="alert">
            {error}
            <button className="text-button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            aria-label="Message Corelum AI"
            placeholder="Message Corelum AI…"
            value={text}
            maxLength={4000}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            className="send-button"
            aria-label="Send message"
            disabled={busy || !text.trim()}
          >
            {busy ? (
              <Loader2 className="spin" size={17} />
            ) : (
              <ArrowUp size={19} />
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
