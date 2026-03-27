"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  BookmarkPlus,
  Copy,
  FileImage,
  FileText,
  HelpCircle,
  History,
  Mic,
  Paperclip,
  SendHorizonal,
  Share2,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { nanoid } from "nanoid";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { Streamdown } from "streamdown";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cardBackgroundImage } from "@/lib/agent-card-visual";
import { formatCredits } from "@/lib/format";

const streamdownPlugins = { cjk, code, math, mermaid };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

type RunResult = {
  output: string;
  remainingCredits: number;
  compute: {
    mode: string;
    model: string;
    providerAddress: string;
  };
  error?: string;
};

type AttachmentItem = {
  id: string;
  file: File;
  previewUrl: string | null;
};

function titleFromText(text: string): string {
  const clean = text.trim();
  if (!clean) {
    return "New chat";
  }
  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
}

function createSession(seedText?: string): ChatSession {
  return {
    id: nanoid(),
    title: seedText ? titleFromText(seedText) : "New chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
}

function sessionStorageKey(agentId: number): string {
  return `ajently-chat-sessions:${agentId}`;
}

function formatMessageTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function greetingForAgent(name: string): string {
  return `Hello! I am ${name}. I can help with focused, high-quality outputs inside my domain. What would you like to work on?`;
}

function buildMessageWithAttachments(text: string, attachments: AttachmentItem[]) {
  const trimmed = text.trim();
  if (attachments.length === 0) {
    return trimmed;
  }

  const attachmentSummary = attachments
    .map((item) => `${item.file.name} (${item.file.type || "file"})`)
    .join(", ");

  return trimmed
    ? `${trimmed}\n\nAttached files: ${attachmentSummary}`
    : `Please use these attached files as context: ${attachmentSummary}`;
}

export function ChatClient({
  agentId,
  agentName,
  agentDescription,
  cardImageDataUrl,
  cardGradient,
  initialCredits,
}: {
  agentId: number;
  agentName: string;
  agentDescription: string;
  cardImageDataUrl: string | null;
  cardGradient: string;
  initialCredits: number;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => [createSession()]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [status, setStatus] = useState<"submitted" | "streaming" | "ready" | "error">("ready");
  const [error, setError] = useState("");
  const [credits, setCredits] = useState(initialCredits);
  const [lastComputeMeta, setLastComputeMeta] = useState<RunResult["compute"] | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, "liked" | "disliked" | null>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null,
    [sessions, activeSessionId],
  );

  useEffect(() => {
    const key = sessionStorageKey(agentId);
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const initialSession = createSession();
      setSessions([initialSession]);
      setActiveSessionId(initialSession.id);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as ChatSession[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Invalid sessions payload");
      }
      setSessions(parsed);
      setActiveSessionId(parsed[0].id);
    } catch {
      const fallback = createSession();
      setSessions([fallback]);
      setActiveSessionId(fallback.id);
    }
  }, [agentId]);

  useEffect(() => {
    if (sessions.length === 0) {
      return;
    }
    window.localStorage.setItem(sessionStorageKey(agentId), JSON.stringify(sessions));
  }, [agentId, sessions]);

  useEffect(() => {
    return () => {
      for (const attachment of attachments) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      }
    };
  }, [attachments]);

  const createNewChat = useCallback(() => {
    const next = createSession();
    setSessions((prev) => [next, ...prev]);
    setActiveSessionId(next.id);
    setInput("");
    setAttachments((current) => {
      for (const item of current) {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
      return [];
    });
    setError("");
    setStatus("ready");
  }, []);

  const appendMessageToActiveSession = useCallback(
    (message: ChatMessage) => {
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== activeSessionId) {
            return session;
          }
          const nextMessages = [...session.messages, message];
          const nextTitle =
            session.messages.length === 0 && message.role === "user"
              ? titleFromText(message.content)
              : session.title;
          return {
            ...session,
            title: nextTitle,
            messages: nextMessages,
            updatedAt: message.createdAt,
          };
        }),
      );
    },
    [activeSessionId],
  );

  const runAgent = useCallback(
    async (rawText: string, currentAttachments: AttachmentItem[]) => {
      const text = buildMessageWithAttachments(rawText, currentAttachments).trim();
      if (!text || status === "submitted" || status === "streaming" || !activeSessionId) {
        return;
      }

      setStatus("submitted");
      setError("");

      appendMessageToActiveSession({
        id: nanoid(),
        role: "user",
        content: text,
        createdAt: Date.now(),
      });

      setInput("");
      setAttachments((items) => {
        for (const item of items) {
          if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
          }
        }
        return [];
      });
      setStatus("streaming");

      try {
        const response = await fetch(`/api/agents/${agentId}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        const payload = (await response.json()) as RunResult;
        if (!response.ok) {
          setError(payload.error ?? "Failed to run agent");
          setStatus("error");
          return;
        }

        appendMessageToActiveSession({
          id: nanoid(),
          role: "assistant",
          content: payload.output,
          createdAt: Date.now(),
        });
        setCredits(payload.remainingCredits);
        setLastComputeMeta(payload.compute);
        setStatus("ready");
      } catch {
        setError("Failed to run agent");
        setStatus("error");
      }
    },
    [activeSessionId, agentId, appendMessageToActiveSession, status],
  );

  const conversation = activeSession?.messages ?? [];
  const visibleMessages =
    conversation.length > 0
      ? conversation
      : [
          {
            id: "greeting",
            role: "assistant" as const,
            content: greetingForAgent(agentName),
            createdAt: Date.now(),
          },
        ];

  const requestCount = conversation.filter((message) => message.role === "user").length;
  const usagePercent = Math.min(100, Math.max(6, Math.round((requestCount / 12) * 100)));

  const copyMessage = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? null : current));
      }, 1800);
    } catch {
      setError("Failed to copy message");
    }
  }, []);

  const shareMessage = useCallback(async (content: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${agentName} response`,
          text: content,
        });
        return;
      }
      await navigator.clipboard.writeText(content);
      setError("Share is not supported here. Response copied instead.");
    } catch {
      setError("Failed to share message");
    }
  }, [agentName]);

  return (
    <div className="grid h-[calc(100vh-74px)] grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="flex h-[calc(100vh-74px)] min-w-0 flex-col overflow-hidden bg-white">
        <div className="border-b border-slate-200 px-6 py-4 sm:px-8">
          <div className="mx-auto flex w-full max-w-[1040px] flex-wrap items-center justify-between gap-4 pl-2 lg:pl-6">
            <div>
              <p className="text-[16px] font-black text-slate-950">{agentName}</p>
              <p className="mt-1 text-xs text-slate-500">
                {lastComputeMeta ? `${lastComputeMeta.mode} · ${lastComputeMeta.model}` : "Interactive agent session"}
              </p>
            </div>

            <div className="flex items-center gap-3 text-slate-500">
              <button
                type="button"
                onClick={createNewChat}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                New chat
              </button>
              <Link href="/" className="text-xs font-semibold text-slate-600 transition hover:text-slate-900">
                Agents
              </Link>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-7 sm:px-7">
          <div className="mx-auto w-full max-w-[1040px] space-y-7 pb-36 pl-2 lg:pl-6">
            {visibleMessages.map((message) => {
              const isAssistant = message.role === "assistant";
              return (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  {isAssistant ? (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#16253f] text-white">
                      <Bot className="h-5 w-5" />
                    </div>
                  ) : null}

                  <div className={`min-w-0 max-w-[min(100%,760px)] ${isAssistant ? "" : "order-first"}`}>
                    <div
                      className={`overflow-hidden rounded-[18px] px-5 py-4 text-[15px] leading-7 ${
                        isAssistant ? "bg-[#16253f] text-white" : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {isAssistant ? (
                        <Streamdown
                          className="size-full break-words text-[15px] leading-7 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-[#0d1a2d] [&_pre]:p-4 [&_strong]:font-black"
                          plugins={streamdownPlugins}
                        >
                          {message.content}
                        </Streamdown>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      )}
                    </div>
                    <p className={`mt-2 text-[11px] text-slate-400 ${isAssistant ? "text-left" : "text-right"}`}>
                      {formatMessageTime(message.createdAt)}
                    </p>
                    <div className={`mt-2 flex items-center gap-1 ${isAssistant ? "" : "justify-end"}`}>
                      <button
                        type="button"
                        onClick={() => void copyMessage(message.id, message.content)}
                        className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Copy message"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {isAssistant ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setMessageFeedback((current) => ({
                                ...current,
                                [message.id]:
                                  current[message.id] === "liked" ? null : "liked",
                              }))
                            }
                            className={`rounded-full p-2 transition hover:bg-slate-100 ${
                              messageFeedback[message.id] === "liked"
                                ? "text-emerald-600"
                                : "text-slate-400 hover:text-slate-700"
                            }`}
                            aria-label="Like response"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setMessageFeedback((current) => ({
                                ...current,
                                [message.id]:
                                  current[message.id] === "disliked" ? null : "disliked",
                              }))
                            }
                            className={`rounded-full p-2 transition hover:bg-slate-100 ${
                              messageFeedback[message.id] === "disliked"
                                ? "text-red-600"
                                : "text-slate-400 hover:text-slate-700"
                            }`}
                            aria-label="Dislike response"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void shareMessage(message.content)}
                            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Share response"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : null}
                      {copiedMessageId === message.id ? (
                        <span className="ml-1 text-[11px] font-semibold text-slate-500">Copied</span>
                      ) : null}
                    </div>
                  </div>

                  {!isAssistant ? (
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cover bg-center"
                      style={{
                        backgroundImage: cardBackgroundImage(cardImageDataUrl, cardGradient),
                      }}
                    />
                  ) : null}
                </div>
              );
            })}

            {status === "submitted" || status === "streaming" ? (
              <div className="flex items-start gap-3 justify-start">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#16253f] text-white">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0 max-w-[min(100%,760px)]">
                  <div className="flex items-center gap-1 rounded-[18px] bg-[#16253f] px-5 py-4 text-white">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-white" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-5 pb-5 pt-3 backdrop-blur sm:px-7">
          <div className="mx-auto w-full max-w-[1040px] pl-2 lg:pl-6">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void runAgent(input, attachments);
              }}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_32px_rgba(15,23,42,0.08)]"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.txt,.md,.doc,.docx,.csv,.json"
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  if (files.length === 0) {
                    return;
                  }

                  setAttachments((current) => [
                    ...current,
                    ...files.map((file) => ({
                      id: nanoid(),
                      file,
                      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
                    })),
                  ]);
                  event.currentTarget.value = "";
                }}
              />

              <input
                ref={imageInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*"
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  if (files.length === 0) {
                    return;
                  }

                  setAttachments((current) => [
                    ...current,
                    ...files.map((file) => ({
                      id: nanoid(),
                      file,
                      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
                    })),
                  ]);
                  event.currentTarget.value = "";
                }}
              />

              {attachments.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="inline-flex max-w-full items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs text-slate-700"
                    >
                      {attachment.file.type.startsWith("image/") ? (
                        <FileImage className="h-4 w-4 shrink-0 text-sky-700" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-sky-700" />
                      )}
                      <span className="truncate">{attachment.file.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((current) => {
                            const target = current.find((item) => item.id === attachment.id);
                            if (target?.previewUrl) {
                              URL.revokeObjectURL(target.previewUrl);
                            }
                            return current.filter((item) => item.id !== attachment.id);
                          })
                        }
                        className="text-slate-500 transition hover:text-slate-800"
                        aria-label={`Remove ${attachment.file.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="text-slate-500 transition hover:text-slate-700"
                      aria-label="Attach files"
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                      Attach image
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                      Attach file
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <input
                  value={input}
                  onChange={(event) => setInput(event.currentTarget.value)}
                  placeholder={`Message ${agentName}...`}
                  className="h-11 w-full min-w-0 bg-transparent text-[16px] text-slate-800 outline-none placeholder:text-slate-400"
                />
                <button type="button" className="text-slate-500 transition hover:text-slate-700" aria-label="Voice input">
                  <Mic className="h-5 w-5" />
                </button>
                <button
                  type="submit"
                  disabled={(!input.trim() && attachments.length === 0) || status === "submitted" || status === "streaming"}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#16253f] text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  <SendHorizonal className="h-4.5 w-4.5" />
                </button>
              </div>
            </form>

            {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
          </div>
        </div>
      </section>

      <aside className="min-w-0 overflow-y-auto border-l border-slate-200 bg-slate-50/70 px-5 py-5">
        <div className="rounded-[24px] bg-white p-5">
          <div className="flex items-start gap-3">
            <div
              className="h-12 w-12 shrink-0 rounded-[16px] bg-cover bg-center"
              style={{
                backgroundImage: cardBackgroundImage(cardImageDataUrl, cardGradient),
              }}
            />
            <div className="min-w-0">
              <p className="text-[16px] font-black text-slate-950">{agentName}</p>
              <p className="mt-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">
                <span className="h-2 w-2 rounded-full bg-sky-700" />
                Active Now
              </p>
            </div>
          </div>

          <p className="mt-4 text-[14px] leading-7 text-slate-600">{agentDescription}</p>

          <Link
            href={`/agents/${agentId}/customize`}
            className="mt-5 flex items-center justify-center gap-2 rounded-2xl border-2 border-sky-700 px-4 py-3 text-[15px] font-bold text-sky-700 transition hover:bg-sky-50"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Customize Agent
          </Link>
        </div>

        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Continue on another platform</p>
          <div className="mt-3 space-y-3">
            <div className="flex w-full items-center rounded-[16px] bg-white px-4 py-3 text-left shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sky-700">
                  <Paperclip className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-slate-900">Telegram</p>
                  <p className="text-xs text-slate-500">Coming soon</p>
                </div>
              </div>
            </div>

            <div className="flex w-full items-center rounded-[16px] bg-white px-4 py-3 text-left shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sky-700">
                  <Paperclip className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-slate-900">WhatsApp</p>
                  <p className="text-xs text-slate-500">Coming soon</p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            Telegram and WhatsApp handoff will return after the required phone-backed bot and business
            setup is configured.
          </p>
        </div>

        <div className="mt-7 rounded-[20px] bg-[#16253f] px-4 py-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Session Usage</p>
            <p className="text-[15px] font-black text-cyan-300">
              {requestCount} / {formatCredits(credits)}
            </p>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/10">
            <div className="h-1.5 rounded-full bg-cyan-400" style={{ width: `${usagePercent}%` }} />
          </div>
          <p className="mt-3 text-xs text-slate-400">Credits available: {formatCredits(credits)}</p>
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={createNewChat}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 text-[14px] font-bold text-slate-900 shadow-sm transition hover:bg-slate-100"
          >
            <Sparkles className="h-4 w-4" />
            Start Fresh Session
          </button>

          <Link
            href={`/agents/${agentId}/knowledge`}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 text-[14px] font-bold text-slate-900 shadow-sm transition hover:bg-slate-100"
          >
            <BookmarkPlus className="h-4 w-4" />
            View Knowledge Parameters
          </Link>

          <div className="flex items-center justify-center gap-2 pt-1 text-xs font-bold text-slate-900">
            <History className="h-4 w-4" />
            View Request History
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <HelpCircle className="h-4 w-4" />
            Session count: {sessions.length}
          </div>
        </div>
      </aside>
    </div>
  );
}
