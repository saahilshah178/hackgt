"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "pdf", label: "Upload a PDF" },
    { id: "text", label: "Paste text" },
    { id: "topic", label: "Type a topic" },
  ];

  return (
    <section aria-labelledby="upload-heading" className="rounded-xl border border-border/60 bg-card p-6">
      <h2 id="upload-heading" className="sr-only">
        Start a new game
      </h2>
      <div role="tablist" aria-label="Source type" className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`h-12 rounded-md px-5 text-lg font-medium focus-visible:outline-2 focus-visible:outline-ring ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:opacity-90"
            }`}
          >
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
          className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center text-xl transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
            dragging ? "border-primary bg-primary/10" : "border-border"
          }`}
        >
          <p className="font-semibold">Drop a PDF here</p>
          <p className="mt-2 text-lg text-muted-foreground">a chapter or a whole textbook · or click to choose a file</p>
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
          <label htmlFor="paste-text" className="text-lg font-medium">
            Paste your notes
          </label>
          <textarea
            id="paste-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-input bg-background p-4 text-lg focus-visible:outline-2 focus-visible:outline-ring"
            placeholder="Paste a chapter, lecture notes, or a study guide…"
          />
          <Button type="submit" size="lg" disabled={busy} className="h-12 self-start text-lg">
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
          <label htmlFor="topic-text" className="text-lg font-medium">
            Topic (built from general knowledge; the game is labeled &ldquo;unsourced&rdquo;)
          </label>
          <input
            id="topic-text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-14 w-full rounded-md border border-input bg-background px-4 text-xl focus-visible:outline-2 focus-visible:outline-ring"
            placeholder="e.g. Limits and continuity"
          />
          <Button type="submit" size="lg" disabled={busy} className="h-12 self-start text-lg">
            {busy ? "Thinking…" : "Continue"}
          </Button>
        </form>
      )}

      {busy && tab === "pdf" && (
        <p role="status" className="mt-4 text-lg">
          Reading your PDF…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-lg text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
