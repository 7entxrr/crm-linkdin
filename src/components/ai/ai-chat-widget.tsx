"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, CheckCircle2, MessageCircle, Send, Sparkles, Trash2, X, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface PerformedAction {
  summary: string;
  ok: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: PerformedAction[];
}

const SUGGESTIONS = [
  "How many candidates do I have by status?",
  "Draft and send a follow-up email to a candidate",
  "Create a task to call my top lead tomorrow",
  "What should I focus on today?",
];

/**
 * Lightweight markdown-ish renderer: supports **bold**, `code`, and preserves
 * line breaks / bullet lists. Kept dependency-free on purpose.
 */
function renderContent(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
    return (
      <span key={i} className="block min-h-[0.5em]">
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={j} className="font-semibold">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("`") && part.endsWith("`")) {
            return (
              <code key={j} className="rounded bg-black/10 px-1 py-0.5 text-[0.8em] dark:bg-white/10">
                {part.slice(1, -1)}
              </code>
            );
          }
          return <span key={j}>{part}</span>;
        })}
      </span>
    );
  });
}

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = (await apiFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      })) as { reply?: string; actions?: PerformedAction[] };
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reply ?? "I couldn't generate a response.",
          actions: res.actions?.length ? res.actions : undefined,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <>
      {/* Floating chat ball */}
      <motion.button
        type="button"
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        onClick={() => setOpen((o) => !o)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full",
          "bg-gradient-to-br from-primary to-teal-600 text-primary-foreground",
          "shadow-lg shadow-primary/30 ring-1 ring-white/20",
          "hover:shadow-xl hover:shadow-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="size-6" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle className="size-6" />
            </motion.span>
          )}
        </AnimatePresence>
        {!open && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-400 ring-2 ring-background">
            <Sparkles className="size-2.5 text-amber-900" />
          </span>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className={cn(
              "fixed bottom-24 right-5 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
              "h-[min(560px,calc(100vh-8rem))] w-[min(400px,calc(100vw-2.5rem))]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-border bg-gradient-to-r from-primary/10 to-teal-600/10 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-600 text-primary-foreground shadow-sm">
                  <Bot className="size-5" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">CRM Assistant</p>
                  <p className="text-xs text-muted-foreground">Knows your CRM data</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    aria-label="Clear conversation"
                    onClick={() => setMessages([])}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-teal-600/15 text-primary">
                    <Sparkles className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Ask me anything about your CRM</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Candidates, outreach, tasks, pipeline — I have the context.
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-1.5",
                    m.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "rounded-br-sm bg-gradient-to-br from-primary to-teal-600 text-primary-foreground"
                        : "rounded-bl-sm bg-muted text-foreground"
                    )}
                  >
                    {renderContent(m.content)}
                  </div>
                  {m.actions?.map((a, j) => (
                    <div
                      key={j}
                      className={cn(
                        "flex max-w-[85%] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs",
                        a.ok
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                      )}
                    >
                      {a.ok ? (
                        <CheckCircle2 className="mt-px size-3.5 shrink-0" />
                      ) : (
                        <XCircle className="mt-px size-3.5 shrink-0" />
                      )}
                      <span>{a.summary}</span>
                    </div>
                  ))}
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="size-1.5 rounded-full bg-muted-foreground"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-border bg-background/60 p-3"
            >
              <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/30">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  placeholder="Ask about your CRM…"
                  className="max-h-28 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-teal-600 text-primary-foreground transition-all",
                    "hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                  )}
                >
                  <Send className="size-4" />
                </button>
              </div>
              <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
                AI can make mistakes. Verify important details in the CRM.
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
