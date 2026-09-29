"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isTyping } from "../input";

/*
 * Cinematic dialogue: a themed box above the letterbox with the speaker's portrait and nameplate, lines typed out
 * (Space, Enter or a click completes the line, then advances), and at the end a row of numbered choices. When the
 * speaker is an npc and free chat is on, an "Ask …" box lets the player type their own question (with suggested ones
 * to get started); the reply joins the conversation as the npc's next line.
 */

export interface SpokenLine {
  /** display name, or null for the narrator (italic caption) */
  name: string | null;
  role?: string;
  /** portrait colour and letter */
  color?: string;
  mono?: string;
  text: string;
}

export interface Choice {
  id: string;
  label: string;
  primary?: boolean;
}

export interface DialogueProps {
  lines: readonly SpokenLine[];
  choices: readonly Choice[];
  onChoose(id: string): void;
  /** free chat with this speaker, or null when unavailable */
  chat: null | {
    name: string;
    suggestions: readonly string[];
    ask(question: string, history: { role: "user" | "assistant"; content: string }[]): Promise<string>;
  };
  reducedMotion: boolean;
  /** text size multiplier from settings */
  textScale: number;
}

const CPS = 55;

export function Dialogue({ lines, choices, onChoose, chat, reducedMotion, textScale }: DialogueProps) {
  const [extra, setExtra] = useState<SpokenLine[]>([]);
  const all = [...lines, ...extra];
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const history = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const line = all[Math.min(index, all.length - 1)];
  const full = line?.text.length ?? 0;
  const typing = shown < full;
  const atEnd = index >= all.length - 1 && !typing;
  const firstChoice = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (reducedMotion) {
      setShown(full);
      return;
    }
    setShown(0);
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const n = Math.min(full, Math.floor(((performance.now() - start) / 1000) * CPS));
      setShown(n);
      if (n < full) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, full, reducedMotion, line?.text]);

  useEffect(() => {
    if (atEnd && !asking) firstChoice.current?.focus({ preventScroll: true });
  }, [atEnd, asking]);

  const advance = useCallback(() => {
    if (typing) setShown(full);
    else if (index < all.length - 1) setIndex((i) => i + 1);
  }, [typing, full, index, all.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === " " || e.key === "Enter") {
        if (atEnd && document.activeElement instanceof HTMLButtonElement) return; // let the focused choice fire
        e.preventDefault();
        advance();
      } else if (atEnd && /^[1-9]$/.test(e.key)) {
        const c = choices[Number(e.key) - 1];
        if (c) {
          e.preventDefault();
          onChoose(c.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, atEnd, choices, onChoose]);

  const send = async (q: string) => {
    const text = q.trim().slice(0, 300);
    if (!text || !chat || asking) return;
    setQuestion("");
    setAsking(true);
    history.current.push({ role: "user", content: text });
    const speaker = lines.find((l) => l.name === chat.name) ?? { name: chat.name };
    setExtra((x) => [...x, { name: "You", color: "#6b6b6b", mono: "Y", text }]);
    setIndex(all.length);
    try {
      const reply = await chat.ask(text, history.current.slice(-8));
      history.current.push({ role: "assistant", content: reply });
      setExtra((x) => [...x, { ...speaker, text: reply }]);
      setIndex(all.length + 1);
    } catch (err) {
      setExtra((x) => [...x, { name: null, text: err instanceof Error ? err.message : "They didn't catch that. Try again in a moment." }]);
      setIndex(all.length + 1);
    } finally {
      setAsking(false);
    }
  };

  if (!line) return null;
  const size = Math.round(21 * textScale);
  return (
    <div className="w3-dialogue w3-fade-in" role="dialog" aria-label={line.name ? `Talking with ${line.name}` : "Story"} data-testid="w3-dialogue" onClick={(e) => (e.target === e.currentTarget ? advance() : undefined)}>
      {line.name && (
        <div className="w3-speaker">
          <span className="w3-portrait" style={{ background: line.color ?? "#6b5a45" }} aria-hidden>
            {line.mono ?? line.name[0]}
          </span>
          <span className="w3-nameplate">
            {line.name}
            {line.role && <small>{line.role}</small>}
          </span>
        </div>
      )}
      <p className={`w3-line${line.name ? "" : " is-narrator"}`} style={{ fontSize: size }} aria-live="polite" onClick={advance} data-testid="w3-line">
        {asking && index >= all.length - 1 && line.name === "You" ? (
          <>
            {line.text}
            <br />
            <span className="w3-thinking" aria-label={`${chat?.name ?? "They"} is thinking`}>
              <span />
              <span />
              <span />
            </span>
          </>
        ) : (
          <>
            {line.text.slice(0, shown)}
            {typing && <span className="w3-line-caret">▍</span>}
          </>
        )}
      </p>
      {atEnd && !asking ? (
        <>
          {chat && (
            <>
              <form
                className="w3-ask"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(question);
                }}
              >
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={`Ask ${chat.name} something…`}
                  aria-label={`Ask ${chat.name} a question`}
                  maxLength={300}
                  data-testid="w3-ask-input"
                  onKeyDown={(e) => e.stopPropagation()}
                />
                <button type="submit" className="w3-choice" disabled={!question.trim()}>
                  Ask
                </button>
              </form>
              {extra.length === 0 && chat.suggestions.length > 0 && (
                <div className="w3-ask-suggest">
                  {chat.suggestions.slice(0, 3).map((s) => (
                    <button key={s} type="button" onClick={() => void send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="w3-choices">
            {choices.map((c, i) => (
              <button key={c.id} ref={i === 0 ? firstChoice : undefined} type="button" className={`w3-choice${c.primary ? " is-primary" : ""}`} onClick={() => onChoose(c.id)} data-testid={`w3-choice-${c.id}`}>
                <kbd aria-hidden>{i + 1}</kbd>
                {c.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <span className="w3-continue" aria-hidden>
          {typing ? "Space to skip" : "Space to continue"}
        </span>
      )}
    </div>
  );
}
