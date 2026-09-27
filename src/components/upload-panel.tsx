"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { ClipboardType, FileUp, Lightbulb, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

type Tab = "pdf" | "text" | "topic";

/**
 * Drop zone + paste box + topic box. Posts to /api/sources and moves to /intake/[sourceId].
 * Keyboard: the drop zone is a button that opens the file picker; tabs are real buttons.
 */
export function UploadPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pdf");
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = useCallback(
    async (init: RequestInit) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/sources", init);
        const body = (await res.json().catch(() => ({}))) as { sourceId?: string; error?: string };
        // The hosting platform rejects request bodies over 4.5 MB before the route runs, so there is no JSON error.
        if (res.status === 413 && !body.error) {
          throw new Error("That PDF is too large to upload (the limit is 4.5 MB). Try one chapter, or paste the text instead.");
        }
        if (!res.ok || !body.sourceId) throw new Error(body.error ?? `Upload failed (${res.status})`);
        router.push(`/intake/${body.sourceId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      }
    },
    [router],
  );

  const sendFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    void submit({ method: "POST", body: form });
  };

  const tabs: { id: Tab; label: string; icon: typeof FileUp }[] = [
    { id: "pdf", label: "Upload a PDF", icon: FileUp },
    { id: "text", label: "Paste text", icon: ClipboardType },
    { id: "topic", label: "Type a topic", icon: Lightbulb },
  ];

  return (
    <section aria-labelledby="upload-heading" className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 id="upload-heading" className="sr-only">
        Start a new game
      </h2>
      <div role="tablist" aria-label="Source type" className="mb-6 grid grid-cols-3 gap-1 rounded-full bg-secondary p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-2 text-sm font-semibold transition sm:text-base ${
              tab === t.id ? "bg-card text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="hidden size-4 sm:block" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pdf" && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop a PDF here or press Enter to choose a file"
          data-testid="drop-zone"
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInput.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            sendFile(e.dataTransfer.files[0]);
          }}
          className={`flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? "border-brand bg-accent" : "border-input hover:border-brand hover:bg-accent/50"
          }`}
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-accent-foreground">
            <UploadCloud className="size-7" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-semibold">Drop a PDF here</p>
          <p className="mt-1 text-base text-muted-foreground">
            a chapter or a whole textbook · or <span className="font-semibold text-primary underline-offset-4 hover:underline">choose a file</span>
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            data-testid="file-input"
            onChange={(e) => sendFile(e.target.files?.[0])}
          />
        </div>
      )}

      {tab === "text" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length < 40) return setError("Paste at least a paragraph.");
            void submit({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
          }}
          className="flex flex-col gap-4"
        >
          <label htmlFor="paste-text" className="text-base font-semibold">
            Paste your notes
          </label>
          <textarea
            id="paste-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="w-full rounded-2xl border border-input bg-card p-4 text-base leading-relaxed focus:border-ring focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            placeholder="Paste a chapter, lecture notes, or a study guide…"
          />
          <Button type="submit" size="lg" disabled={busy} className="h-11 self-start rounded-full px-6 text-base font-semibold">
            {busy ? "Reading…" : "Continue"}
          </Button>
        </form>
      )}

      {tab === "topic" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (topic.trim().length < 3) return setError("Name a topic.");
            void submit({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic }) });
          }}
          className="flex flex-col gap-4"
        >
          <label htmlFor="topic-text" className="text-base font-semibold">
            Topic (built from general knowledge; the game is labeled &ldquo;unsourced&rdquo;)
          </label>
          <input
            id="topic-text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-12 w-full rounded-full border border-input bg-card px-5 text-base focus:border-ring focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            placeholder="e.g. Limits and continuity"
          />
          <Button type="submit" size="lg" disabled={busy} className="h-11 self-start rounded-full px-6 text-base font-semibold">
            {busy ? "Thinking…" : "Continue"}
          </Button>
        </form>
      )}

      {busy && tab === "pdf" && (
        <p role="status" className="mt-4 text-base font-medium text-accent-foreground">
          Reading your PDF…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-2 text-base text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
