"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";

import { formatCredits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { nanoid } from "nanoid";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
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

const SUGGESTIONS = [
  "Summarize what this agent does best.",
  "Give me a step-by-step plan for this task.",
  "What inputs should I provide for best results?",
  "Show me an example output I can reuse.",
];

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

export function ChatClient({
  agentId,
  agentName,
  initialCredits,
}: {
  agentId: number;
  agentName: string;
  initialCredits: number;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => [createSession()]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"submitted" | "streaming" | "ready" | "error">("ready");
  const [error, setError] = useState("");
  const [credits, setCredits] = useState(initialCredits);
  const [lastComputeMeta, setLastComputeMeta] = useState<RunResult["compute"] | null>(null);

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

  const createNewChat = useCallback(() => {
    const next = createSession();
    setSessions((prev) => [next, ...prev]);
    setActiveSessionId(next.id);
    setInput("");
    setError("");
    setStatus("ready");
  }, []);

  const appendMessageToActiveSession = useCallback((message: ChatMessage) => {
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
          updatedAt: Date.now(),
        };
      }),
    );
  }, [activeSessionId]);

  const runAgent = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || status === "submitted" || status === "streaming" || !activeSessionId) {
      return;
    }

    setStatus("submitted");
    setError("");

    appendMessageToActiveSession({
      id: nanoid(),
      role: "user",
      content: text,
    });

    setInput("");
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
      });
      setCredits(payload.remainingCredits);
      setLastComputeMeta(payload.compute);
      setStatus("ready");
    } catch {
      setError("Failed to run agent");
      setStatus("error");
    }
  }, [activeSessionId, agentId, appendMessageToActiveSession, status]);

  const handlePromptSubmit = useCallback(async (message: PromptInputMessage) => {
    if (message.files.length > 0) {
      setError("Attachments are not supported for this agent yet.");
    }
    await runAgent(message.text);
  }, [runAgent]);

  return (
    <div className="grid min-h-[78vh] gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="flex flex-col rounded-2xl border border-ink/15 p-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-flare">Agent Chat</p>
          <h1 className="text-xl font-black">{agentName}</h1>
          <p className="font-[var(--font-mono)] text-xs uppercase">
            Credits: {formatCredits(credits)}
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <Button type="button" className="flex-1" onClick={createNewChat}>
            New chat
          </Button>
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => {
                setActiveSessionId(session.id);
                setError("");
              }}
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                activeSession?.id === session.id
                  ? "border-ink bg-ink text-white"
                  : "border-ink/15 bg-white/70 hover:bg-ink/5",
              )}
            >
              <p className="truncate font-semibold">{session.title}</p>
              <p className={cn("mt-1 text-xs", activeSession?.id === session.id ? "text-white/80" : "text-ink/60")}>
                {new Date(session.updatedAt).toLocaleString()}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-3">
          <Link
            href={`/agents/${agentId}`}
            className="inline-flex rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold hover:bg-ink/5"
          >
            Back to agent details
          </Link>
        </div>
      </aside>

      <div className="flex min-h-0 flex-col rounded-2xl border border-ink/15">
        <div className="border-b border-ink/10 px-4 py-3">
          <p className="text-sm font-semibold">{activeSession?.title ?? "New chat"}</p>
          {lastComputeMeta ? (
            <p className="muted mt-1 font-[var(--font-mono)] text-xs uppercase">
              {lastComputeMeta.mode} | {lastComputeMeta.model}
            </p>
          ) : null}
        </div>

        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="p-4">
            {activeSession?.messages.length ? (
              activeSession.messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    <MessageResponse>{message.content}</MessageResponse>
                  </MessageContent>
                </Message>
              ))
            ) : (
              <ConversationEmptyState
                title="No messages yet"
                description="Start chatting with this agent."
              />
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-ink/10 p-3">
          <Suggestions className="mb-2">
            {SUGGESTIONS.map((suggestion) => (
              <Suggestion key={suggestion} suggestion={suggestion} onClick={runAgent} />
            ))}
          </Suggestions>

          <PromptInput onSubmit={handlePromptSubmit}>
            <PromptInputBody>
              <PromptInputTextarea
                value={input}
                onChange={(event) => setInput(event.currentTarget.value)}
                placeholder="Ask this agent anything..."
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools />
              <PromptInputSubmit
                disabled={!input.trim() || status === "submitted" || status === "streaming"}
                status={status}
              />
            </PromptInputFooter>
          </PromptInput>

          {error ? <p className="mt-2 text-sm font-semibold text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
