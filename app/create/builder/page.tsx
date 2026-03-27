"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  ArrowLeft,
  Bot,
  BrainCircuit,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Globe,
  Minus,
  Plus,
  SquareArrowOutUpRight,
} from "lucide-react";
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { nanoid } from "nanoid";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

gsap.registerPlugin(Draggable);

type NodeKind = "chatgpt" | "claude" | "gemini" | "input" | "output" | "memory" | "tool";
type NodeRect = { x: number; y: number; width: number; height: number };
type Connection = { id: string; from: string; to: string; dashed?: boolean };
type CanvasNode = {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle: string;
  tag?: string;
  x: number;
  y: number;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  toolSlug?: string;
  active?: boolean;
};
type NodeTemplate = {
  title: string;
  subtitle: string;
  tag?: string;
  icon: ComponentType<{ className?: string }>;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  toolSlug?: string;
};

const CANVAS_WIDTH = 2400;
const CANVAS_HEIGHT = 1600;

const NODE_TEMPLATES: Record<NodeKind, NodeTemplate> = {
  chatgpt: {
    title: "ChatGPT-4o",
    subtitle: "Process incoming user query and determine intent for routing.",
    tag: "LLM",
    icon: Bot,
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: "Provide concise, accurate information about Ajently and remain professional.",
  },
  claude: {
    title: "Claude Sonnet",
    subtitle: "Handle multi-step reasoning and polished conversational output.",
    tag: "LLM",
    icon: BrainCircuit,
    temperature: 0.4,
    maxTokens: 3072,
    systemPrompt: "Synthesize context carefully and hand off well-formed outputs downstream.",
  },
  gemini: {
    title: "Gemini Vision",
    subtitle: "Analyze multimodal context and prepare image-aware responses.",
    tag: "VISION",
    icon: BrainCircuit,
    temperature: 0.5,
    maxTokens: 4096,
    systemPrompt: "Inspect images and text together and return concise structured observations.",
  },
  input: {
    title: "User Input",
    subtitle: "Capture the initial user message and route it into the workflow.",
    icon: SquareArrowOutUpRight,
    temperature: 0.2,
    maxTokens: 512,
    systemPrompt: "Accept the inbound request and normalize it before sending it to the next node.",
  },
  output: {
    title: "Output Node",
    subtitle: "Deliver the final result back to the user or external channel.",
    icon: SquareArrowOutUpRight,
    temperature: 0.2,
    maxTokens: 512,
    systemPrompt: "Return the final response cleanly and preserve the structure of the workflow output.",
  },
  memory: {
    title: "Short-Term Memory",
    subtitle: "Store and retrieve immediate conversational context for later nodes.",
    icon: Database,
    temperature: 0.1,
    maxTokens: 512,
    systemPrompt: "Store key context from the conversation and make it retrievable for dependent nodes.",
  },
  tool: {
    title: "Search Tool",
    subtitle: "Fetch fresh context from external sources and enrich the response.",
    icon: Globe,
    temperature: 0.1,
    maxTokens: 512,
    systemPrompt: "Use controlled external search to retrieve the most relevant supporting facts.",
    toolSlug: "google_search",
  },
};

const LIBRARY = [
  { label: "Intelligence", items: ["chatgpt", "claude", "gemini"] as NodeKind[] },
  { label: "Inputs & Outputs", items: ["input", "output"] as NodeKind[] },
  { label: "Memory & Tools", items: ["memory", "tool"] as NodeKind[] },
] as const;

const INITIAL_NODES: CanvasNode[] = [
  { id: "node-input", kind: "input", ...NODE_TEMPLATES.input, x: 180, y: 300 },
  { id: "node-chatgpt", kind: "chatgpt", ...NODE_TEMPLATES.chatgpt, x: 560, y: 220, active: true },
  { id: "node-memory", kind: "memory", ...NODE_TEMPLATES.memory, x: 1120, y: 110 },
  { id: "node-tool", kind: "tool", ...NODE_TEMPLATES.tool, x: 1120, y: 560 },
];

const INITIAL_CONNECTIONS: Connection[] = [
  { id: "a", from: "node-input", to: "node-chatgpt" },
  { id: "b", from: "node-chatgpt", to: "node-memory" },
  { id: "c", from: "node-chatgpt", to: "node-tool", dashed: true },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable);

function deriveAgentDescription(nodes: CanvasNode[]) {
  const activeKinds = Array.from(new Set(nodes.map((node) => node.kind)));
  const parts: string[] = [];

  if (activeKinds.includes("input")) parts.push("captures user requests");
  if (activeKinds.includes("chatgpt") || activeKinds.includes("claude") || activeKinds.includes("gemini")) {
    parts.push("reasons through planning tasks");
  }
  if (activeKinds.includes("memory")) parts.push("maintains working context");
  if (activeKinds.includes("tool")) parts.push("enriches outputs with external research");
  if (activeKinds.includes("output")) parts.push("returns structured deliverables");

  const summary = parts.length > 0 ? parts.join(", ") : "orchestrates a custom AI workflow";
  return `A workflow-built AI agent that ${summary}.`;
}

function pathFor(from: NodeRect, to: NodeRect) {
  const sx = from.x + from.width;
  const sy = from.y + from.height / 2;
  const ex = to.x;
  const ey = to.y + to.height / 2;
  const delta = Math.max(120, Math.abs(ex - sx) * 0.42);
  return `M ${sx} ${sy} C ${sx + delta} ${sy}, ${ex - delta} ${ey}, ${ex} ${ey}`;
}

function NodeCard({
  node,
  selected,
  connecting,
  onSelect,
  onNodeClick,
  onStart,
  onComplete,
  onDuplicate,
  onDelete,
  registerRef,
}: {
  node: CanvasNode;
  selected: boolean;
  connecting: boolean;
  onSelect: (id: string) => void;
  onNodeClick: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}) {
  const Icon = NODE_TEMPLATES[node.kind].icon;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={(el) => registerRef(node.id, el)}
          onMouseDown={() => onSelect(node.id)}
          onClick={() => onNodeClick(node.id)}
          className={`absolute w-[260px] cursor-grab rounded-[22px] border bg-white px-5 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ${
            selected ? "border-sky-500" : "border-slate-200"
          }`}
          style={{ left: `${node.x}px`, top: `${node.y}px` }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onComplete(node.id);
            }}
            className={`absolute -left-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded-full border-2 ${
              connecting ? "border-sky-700 bg-sky-200" : "border-white bg-sky-500"
            }`}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStart(node.id);
            }}
            className="absolute -right-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500"
          />
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sky-700">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-[15px] font-bold text-slate-900">{node.title}</p>
            </div>
            {node.tag ? <span className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white">{node.tag}</span> : null}
          </div>
          <p className="mt-4 max-w-[210px] text-sm leading-6 text-slate-500">{node.subtitle}</p>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>TEMP: {node.temperature.toFixed(1)}</span>
            <span className="text-sky-700">{node.active ? "Active" : "Idle"}</span>
          </div>
          {node.toolSlug ? <div className="mt-4 inline-flex rounded-md bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{node.toolSlug}</div> : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuLabel>{node.title}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onStart(node.id)}>Add Connector</ContextMenuItem>
        <ContextMenuItem onClick={() => onComplete(node.id)}>Complete Connector</ContextMenuItem>
        <ContextMenuItem onClick={() => onDuplicate(node.id)}>Duplicate Node</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-red-600 focus:text-red-600" onClick={() => onDelete(node.id)}>
          Delete Node
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default function CreateAgentBuilderPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [connections, setConnections] = useState(INITIAL_CONNECTIONS);
  const [activeNodeId, setActiveNodeId] = useState("node-chatgpt");
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [status, setStatus] = useState<"Draft" | "Published">("Draft");
  const [agentName, setAgentName] = useState("Untitled");
  const [zoom, setZoom] = useState(1);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rects, setRects] = useState<Record<string, NodeRect>>({});
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);

  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const draggables = useRef(new Map<string, Draggable[]>());
  const nodesRef = useRef(INITIAL_NODES);
  const copiedNodeRef = useRef<CanvasNode | null>(null);

  const nodeIdsKey = useMemo(() => nodes.map((n) => n.id).join("|"), [nodes]);
  const activeNode = nodes.find((n) => n.id === activeNodeId) ?? nodes[0];
  const canPublish = nodes.length >= 3 && connections.length >= 2;

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(id, el);
    else nodeRefs.current.delete(id);
  }, []);

  const refreshRects = useCallback(() => {
    const next: Record<string, NodeRect> = {};
    for (const [id, el] of nodeRefs.current.entries()) {
      next[id] = { x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
    }
    setRects(next);
  }, []);

  useLayoutEffect(() => {
    nodes.forEach((node) => {
      const el = nodeRefs.current.get(node.id);
      if (el) gsap.set(el, { left: node.x, top: node.y });
    });
    refreshRects();
  }, [nodes, zoom, refreshRects]);

  useLayoutEffect(() => {
    const map = draggables.current;
    const currentNodes = nodesRef.current;
    for (const [id, instances] of map.entries()) {
      if (!nodeRefs.current.has(id)) {
        instances.forEach((instance) => instance.kill());
        map.delete(id);
      }
    }
    currentNodes.forEach((node) => {
      if (map.has(node.id)) return;
      const el = nodeRefs.current.get(node.id);
      const bounds = canvasRef.current;
      if (!el || !bounds) return;
      map.set(
        node.id,
        Draggable.create(el, {
          type: "left,top",
          bounds,
          edgeResistance: 0.65,
          allowEventDefault: true,
          allowContextMenu: true,
          onPress: () => setActiveNodeId(node.id),
          onDrag: function () {
            const x = Number(gsap.getProperty(this.target, "left"));
            const y = Number(gsap.getProperty(this.target, "top"));
            nodesRef.current = nodesRef.current.map((item) => (item.id === node.id ? { ...item, x, y } : item));
            refreshRects();
          },
          onDragEnd: function () {
            const x = Number(gsap.getProperty(this.target, "left"));
            const y = Number(gsap.getProperty(this.target, "top"));
            const nextNodes = nodesRef.current.map((item) => (item.id === node.id ? { ...item, x, y } : item));
            nodesRef.current = nextNodes;
            setNodes(nextNodes);
            refreshRects();
          },
        }),
      );
    });
    return () => {
      for (const items of map.values()) items.forEach((instance) => instance.kill());
      map.clear();
    };
  }, [nodeIdsKey, refreshRects]);

  const setCanvasZoom = useCallback((value: number) => {
    const next = clamp(Number(value.toFixed(2)), 0.6, 1.6);
    setZoom(next);
  }, []);

  const updateNodes = useCallback((updater: (current: CanvasNode[]) => CanvasNode[]) => {
    setNodes((current) => {
      const next = updater(current);
      nodesRef.current = next;
      return next;
    });
  }, []);

  const addNode = useCallback((kind: NodeKind) => {
    const t = NODE_TEMPLATES[kind];
    const offset = nodes.length * 36;
    const newNode: CanvasNode = { id: nanoid(), kind, ...t, x: 220 + offset, y: 180 + offset };
    updateNodes((current) => [...current, newNode]);
    setActiveNodeId(newNode.id);
  }, [nodes.length, updateNodes]);

  const duplicateNode = useCallback((nodeId: string) => {
    const source = nodesRef.current.find((node) => node.id === nodeId);
    if (!source) return;
    const clone: CanvasNode = {
      ...source,
      id: nanoid(),
      title: `${source.title} Copy`,
      x: source.x + 120,
      y: source.y + 80,
      active: false,
    };
    updateNodes((current) => [...current, clone]);
    setActiveNodeId(clone.id);
  }, [updateNodes]);

  const deleteNode = useCallback((nodeId: string) => {
    updateNodes((current) => current.filter((node) => node.id !== nodeId));
    setConnections((current) => current.filter((connection) => connection.from !== nodeId && connection.to !== nodeId));
    setConnectingFromId((current) => (current === nodeId ? null : current));
    setActiveNodeId((current) => (current === nodeId ? nodesRef.current.find((node) => node.id !== nodeId)?.id ?? "" : current));
  }, [updateNodes]);

  const resetWorkspace = useCallback(() => {
    nodesRef.current = INITIAL_NODES;
    setNodes(INITIAL_NODES);
    setConnections(INITIAL_CONNECTIONS);
    setActiveNodeId("node-chatgpt");
    setConnectingFromId(null);
    setStatus("Draft");
    setAgentName("Untitled");
    setCanvasZoom(1);
  }, [setCanvasZoom]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!activeNodeId) return;
        event.preventDefault();
        deleteNode(activeNodeId);
        return;
      }
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || !activeNodeId) return;
      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        copiedNodeRef.current = nodesRef.current.find((node) => node.id === activeNodeId) ?? null;
      }
      if (event.key.toLowerCase() === "v" && copiedNodeRef.current) {
        event.preventDefault();
        const source = copiedNodeRef.current;
        const clone: CanvasNode = {
          ...source,
          id: nanoid(),
          title: `${source.title} Copy`,
          x: source.x + 80,
          y: source.y + 80,
          active: false,
        };
        updateNodes((current) => [...current, clone]);
        setActiveNodeId(clone.id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeNodeId, deleteNode, updateNodes]);

  const preview = useCallback(() => {
    const tl = gsap.timeline();
    connections.forEach((c, i) => {
      const path = document.querySelector(`[data-connection-id="${c.id}"]`);
      if (path instanceof SVGPathElement) {
        const length = path.getTotalLength();
        tl.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 0.42, ease: "power2.out" }, i * 0.08);
      }
    });
  }, [connections]);

  const paths = useMemo(
    () =>
      connections
        .map((c) => {
          const from = rects[c.from];
          const to = rects[c.to];
          if (!from || !to) return null;
          return { ...c, d: pathFor(from, to) };
        })
        .filter(Boolean) as Array<Connection & { d: string }>,
    [connections, rects],
  );

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const direction = event.deltaY > 0 ? -0.08 : 0.08;
      setCanvasZoom(zoom + direction);
    };
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [setCanvasZoom, zoom]);

  const completeConnection = useCallback((targetId: string) => {
    if (!connectingFromId || connectingFromId === targetId) {
      setConnectingFromId(null);
      return;
    }
    setConnections((current) =>
      current.some((c) => c.from === connectingFromId && c.to === targetId)
        ? current
        : [...current, { id: nanoid(), from: connectingFromId, to: targetId }],
    );
    setConnectingFromId(null);
  }, [connectingFromId]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setActiveNodeId(nodeId);
    if (connectingFromId && connectingFromId !== nodeId) {
      completeConnection(nodeId);
    }
  }, [completeConnection, connectingFromId]);

  const handlePublish = useCallback(async () => {
    if (!canPublish || publishing) return;
    setPublishing(true);
    setPublishError("");

    const formData = new FormData();
    formData.set("name", agentName.trim() || "Untitled");
    formData.set("description", deriveAgentDescription(nodesRef.current));
    formData.set("category", "Productivity");
    formData.set("model", "openai/gpt-oss-120b:free");
    formData.set("system_prompt", activeNode?.systemPrompt || "Execute the configured workflow accurately.");
    formData.set("price_per_run", "12");
    formData.set("card_gradient", "ocean");
    formData.set("publish_now", "true");

    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        agent?: { id: number };
        error?: string;
      };

      if (!response.ok || !data.agent?.id) {
        setPublishError(data.error ?? "Failed to publish agent");
        setPublishing(false);
        return;
      }

      setStatus("Published");
      router.push(`/agents/${data.agent.id}`);
      router.refresh();
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Failed to publish agent");
      setPublishing(false);
    }
  }, [activeNode?.systemPrompt, agentName, canPublish, publishing, router]);

  return (
    <main className="h-screen overflow-hidden bg-white">
      <div className="mx-auto grid h-screen w-full max-w-[1600px] border border-slate-200" style={{ gridTemplateColumns: `${leftCollapsed ? 72 : 240}px minmax(0,1fr) ${rightCollapsed ? 72 : 320}px` }}>
        <aside className="relative flex min-h-0 flex-col border-r border-slate-200 bg-slate-50/90">
          <div className="flex items-start justify-between px-4 py-6">
            {!leftCollapsed ? (
              <div>
                <h1 className="text-[40px] font-black tracking-[-0.04em] text-slate-950">Blocks</h1>
                <p className="mt-1 text-sm font-bold uppercase tracking-[0.12em] text-slate-500">Node Library</p>
              </div>
            ) : <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sky-700"><Bot className="h-5 w-5" /></div>}
            <button type="button" onClick={() => setLeftCollapsed((v) => !v)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
              {leftCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
          </div>
          {!leftCollapsed ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24">
              <div className="space-y-10">
                {LIBRARY.map((group) => (
                  <section key={group.label}>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
                    <div className="mt-5 space-y-4">
                      {group.items.map((kind) => {
                        const item = NODE_TEMPLATES[kind];
                        const Icon = item.icon;
                        return (
                          <button key={kind} type="button" onClick={() => addNode(kind)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[16px] text-slate-600 transition hover:bg-white">
                            <Icon className="h-5 w-5 text-sky-700" />
                            {item.title}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-3 pb-20">
              {LIBRARY.flatMap((group) => group.items).map((kind) => {
                const Icon = NODE_TEMPLATES[kind].icon;
                return <button key={kind} type="button" onClick={() => addNode(kind)} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm"><Icon className="h-5 w-5" /></button>;
              })}
            </div>
          )}
          <button type="button" onClick={resetWorkspace} className={`absolute bottom-4 flex items-center justify-center rounded-2xl bg-slate-200 py-4 text-sm font-bold uppercase tracking-[0.08em] text-slate-800 ${leftCollapsed ? "left-3 h-11 w-11 px-0" : "left-4 w-[208px] px-5"}`}>
            {leftCollapsed ? "R" : "Reset Workspace"}
          </button>
        </aside>

        <section className="flex min-w-0 flex-col overflow-hidden bg-white">
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-8">
            <div className="flex items-center gap-4">
              <Link href="/create" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <input
                value={agentName}
                onChange={(e) => setAgentName(e.currentTarget.value)}
                onBlur={() => setAgentName((current) => current.trim() || "Untitled")}
                className="min-w-[320px] border-none bg-transparent text-[28px] font-black text-slate-900 outline-none"
                aria-label="Agent name"
                placeholder="Untitled"
                spellCheck={false}
              />
              <span className="rounded-md bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-sky-700">{status}</span>
              {connectingFromId ? <span className="rounded-md bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-cyan-700">Click a destination handle</span> : null}
              {publishError ? <span className="rounded-md bg-red-50 px-3 py-1 text-xs font-bold text-red-600">{publishError}</span> : null}
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={!canPublish}
                onClick={handlePublish}
                className="rounded-xl bg-slate-200 px-4 py-2.5 text-base font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {publishing ? "Publishing..." : "Publish Agent"}
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_40%_20%,rgba(56,189,248,0.08),transparent_22%),linear-gradient(180deg,#ffffff,#f8fbff)]">
            <div ref={canvasViewportRef} className="h-full w-full overflow-auto">
              <div className="relative" style={{ width: `${CANVAS_WIDTH * zoom}px`, height: `${CANVAS_HEIGHT * zoom}px` }}>
                <div ref={canvasRef} className="relative origin-top-left" style={{ width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px`, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
                  <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" fill="none">
                    {paths.map((p) => (
                      <path key={p.id} data-connection-id={p.id} d={p.d} stroke={p.dashed ? "#0EA5E9" : "#B9C1CC"} strokeDasharray={p.dashed ? "8 8" : undefined} strokeWidth="2.5" strokeLinecap="round" />
                    ))}
                  </svg>
                  {nodes.map((node) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      selected={activeNodeId === node.id}
                      connecting={connectingFromId === node.id}
                      registerRef={registerRef}
                      onSelect={setActiveNodeId}
                      onNodeClick={handleNodeClick}
                      onStart={setConnectingFromId}
                      onComplete={completeConnection}
                      onDuplicate={duplicateNode}
                      onDelete={deleteNode}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute bottom-4 left-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
              <button type="button" onClick={() => setCanvasZoom(zoom + 0.1)} className="text-lg leading-none"><Plus className="h-4 w-4" /></button>
              {Math.round(zoom * 100)}%
              <button type="button" onClick={() => setCanvasZoom(zoom - 0.1)} className="text-lg leading-none"><Minus className="h-4 w-4" /></button>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-slate-50/70">
          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-7">
            {!rightCollapsed ? (
              <div>
                <h2 className="text-[22px] font-black text-slate-950">Configuration</h2>
                <p className="mt-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-500">{activeNode?.title ?? "Node"} Settings</p>
              </div>
            ) : <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm"><Check className="h-5 w-5" /></div>}
            <button type="button" onClick={() => setRightCollapsed((v) => !v)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
              {rightCollapsed ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
          </div>
          {!rightCollapsed ? (
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {activeNode ? (
                <div className="space-y-8">
                  <section>
                    <p className="text-sm font-bold uppercase tracking-[0.1em] text-slate-600">Model Selection</p>
                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-200 px-4 py-4 text-[18px] text-slate-800">{activeNode.title}<span>v</span></div>
                  </section>
                  <section>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-bold uppercase tracking-[0.1em] text-slate-600">Node Label</p>
                      <span className="text-sm font-semibold text-sky-700">Editable</span>
                    </div>
                    <input
                      value={activeNode.title}
                      onChange={(e) => {
                        const nextValue = e.currentTarget.value;
                        updateNodes((current) => current.map((n) => (n.id === activeNode.id ? { ...n, title: nextValue } : n)));
                      }}
                      className="mt-4 w-full rounded-2xl bg-slate-200 px-4 py-4 text-[18px] text-slate-800 outline-none"
                    />
                  </section>
                  <section>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-bold uppercase tracking-[0.1em] text-slate-600">System Prompt</p>
                      <span className="text-sm font-semibold text-sky-700">Variables {`{ }`}</span>
                    </div>
                    <textarea
                      value={activeNode.systemPrompt}
                      onChange={(e) => {
                        const nextValue = e.currentTarget.value;
                        updateNodes((current) => current.map((n) => (n.id === activeNode.id ? { ...n, systemPrompt: nextValue } : n)));
                      }}
                      rows={6}
                      className="mt-4 w-full rounded-[20px] bg-slate-200 px-4 py-4 text-[16px] leading-8 text-slate-800 outline-none"
                    />
                  </section>
                  <section>
                    <div className="flex items-center justify-between text-sm font-bold uppercase tracking-[0.1em] text-slate-600"><span>Temperature</span><span className="text-sky-700">{activeNode.temperature.toFixed(1)}</span></div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={activeNode.temperature}
                      onChange={(e) => {
                        const nextValue = Number(e.currentTarget.value);
                        updateNodes((current) => current.map((n) => (n.id === activeNode.id ? { ...n, temperature: nextValue } : n)));
                      }}
                      className="mt-4 w-full accent-sky-700"
                    />
                  </section>
                  <section>
                    <div className="flex items-center justify-between text-sm font-bold uppercase tracking-[0.1em] text-slate-600"><span>Max Tokens</span><span className="text-sky-700">{activeNode.maxTokens}</span></div>
                    <input
                      type="range"
                      min="256"
                      max="4096"
                      step="256"
                      value={activeNode.maxTokens}
                      onChange={(e) => {
                        const nextValue = Number(e.currentTarget.value);
                        updateNodes((current) => current.map((n) => (n.id === activeNode.id ? { ...n, maxTokens: nextValue } : n)));
                      }}
                      className="mt-4 w-full accent-sky-700"
                    />
                  </section>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-3 py-5">
              {[Bot, Database, Globe, Plus].map((Icon, i) => <div key={i} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm"><Icon className="h-5 w-5" /></div>)}
            </div>
          )}
          <div className={`border-t border-slate-200 ${rightCollapsed ? "px-3 py-4" : "px-6 py-6"}`}>
            <button type="button" onClick={preview} className="flex w-full items-center justify-center rounded-2xl bg-[#0f7b94] px-5 py-4 text-[18px] font-bold text-white">{rightCollapsed ? "Go" : "Apply Changes"}</button>
          </div>
        </aside>
      </div>
    </main>
  );
}
