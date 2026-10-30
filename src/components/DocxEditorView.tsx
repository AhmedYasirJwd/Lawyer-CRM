"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import {
  loadDocx,
  saveDocx,
  updateRunText,
  downloadBlob,
  type DocxDocument as ParsedDocx,
  type DocxParagraph,
} from "@/lib/docx-editor";

function RunSpan({ run, docRef }: { run: { id: string; text: string; bold: boolean; italic: boolean; underline: boolean; fontFamily?: string; fontSizePt?: number; color?: string }; docRef: React.RefObject<ParsedDocx | null> }) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-run-id={run.id}
      onInput={(e) => {
        if (!docRef.current) return;
        updateRunText(docRef.current, run.id, e.currentTarget.textContent ?? "");
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      style={{
        fontFamily: run.fontFamily ? `"${run.fontFamily}", Calibri, Arial, sans-serif` : undefined,
        fontSize: run.fontSizePt ? `${run.fontSizePt}pt` : undefined,
        fontWeight: run.bold ? 700 : undefined,
        fontStyle: run.italic ? "italic" : undefined,
        textDecoration: run.underline ? "underline" : undefined,
        color: run.color,
        outline: "none",
      }}
      className="rounded-sm focus:bg-brand-50"
    >
      {run.text}
    </span>
  );
}

function ParagraphBlock({ paragraph, docRef }: { paragraph: DocxParagraph; docRef: React.RefObject<ParsedDocx | null> }) {
  const isEmpty = paragraph.segments.length === 0;
  return (
    <p
      style={{ textAlign: paragraph.align, minHeight: isEmpty ? "1.4em" : undefined }}
      className="mb-3 leading-relaxed text-[#1a1a1a] last:mb-0"
    >
      {paragraph.segments.map((seg, i) => {
        if (seg.type === "run") return <RunSpan key={seg.run.id} run={seg.run} docRef={docRef} />;
        if (seg.type === "tab") return <span key={i} style={{ display: "inline-block", width: "2.5em" }} />;
        return <br key={i} />;
      })}
    </p>
  );
}

export function DocxEditorView({ fileUrl, fileName, title }: { fileUrl: string; fileName: string; title: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [paragraphs, setParagraphs] = useState<DocxParagraph[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [savedName, setSavedName] = useState(fileName);
  const docRef = useRef<ParsedDocx | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function load() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("Couldn't load this document.");
      const buf = await res.arrayBuffer();
      const parsed = await loadDocx(buf);
      docRef.current = parsed;
      setParagraphs(parsed.paragraphs);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong opening this document.");
      setStatus("error");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches the file on mount / when the URL changes
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  async function handleDownload() {
    if (!docRef.current) return;
    setDownloading(true);
    try {
      const blob = await saveDocx(docRef.current);
      downloadBlob(blob, savedName);
    } finally {
      setDownloading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="card flex flex-col items-center justify-center gap-2 p-16 text-center">
        <Loader2 size={22} className="animate-spin text-brand-600" />
        <p className="text-sm text-muted">Opening {title}...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="card flex flex-col items-center justify-center gap-2 p-16 text-center">
        <AlertTriangle size={22} className="text-red-500" />
        <p className="text-sm font-medium text-ink">{error}</p>
        <button onClick={load} className="mt-2 text-sm font-medium text-brand-700 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Click into the text and edit directly. Font, size, and formatting stay exactly as they are.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-muted hover:bg-background"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Download edited .docx
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-4 sm:p-6">
        <div
          ref={containerRef}
          className="mx-auto min-h-[500px] w-full max-w-[760px] bg-white px-4 py-8 sm:px-12"
        >
          {paragraphs.map((p) => (
            <ParagraphBlock key={p.id} paragraph={p} docRef={docRef} />
          ))}
        </div>
      </div>

      <label className="mt-4 block max-w-xs">
        <span className="mb-1.5 block text-xs font-medium text-muted">File name for download</span>
        <input
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          value={savedName}
          onChange={(e) => setSavedName(e.target.value)}
        />
      </label>
    </div>
  );
}
