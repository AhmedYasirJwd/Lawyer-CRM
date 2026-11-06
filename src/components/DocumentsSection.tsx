"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Download, Trash2, UploadCloud, Loader2, HardDriveDownload, CircleCheck } from "lucide-react";
import type { CaseDocument } from "@/lib/types";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { compressImageIfNeeded } from "@/lib/compress-image";
import { isDocumentSavedOffline, saveDocumentOffline, removeDocumentOffline } from "@/lib/document-offline-cache";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { DocumentViewer } from "./DocumentViewer";
import { tint } from "@/lib/urgency";

export function DocumentsSection({ caseId, initialDocuments }: { caseId: string; initialDocuments: CaseDocument[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<"compressing" | "uploading" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<CaseDocument | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const online = useOnlineStatus();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        documents.map(async (d) => [d.id, await isDocumentSavedOffline(d.id)] as const)
      );
      if (!cancelled) setSavedOffline(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents.map((d) => d.id).join(",")]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const rawFile of Array.from(files)) {
        setStage("compressing");
        const file = await compressImageIfNeeded(rawFile);

        setStage("uploading");
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/cases/${caseId}/documents`, { method: "POST", body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Upload failed");
        }
        const doc: CaseDocument = await res.json();
        setDocuments((docs) => [doc, ...docs]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document. Please try again.");
    } finally {
      setUploading(false);
      setStage(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDocuments((docs) => docs.filter((d) => d.id !== id));
      await removeDocumentOffline(id);
    } catch {
      setError("Failed to delete document. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleOffline(id: string) {
    if (savedOffline[id]) {
      await removeDocumentOffline(id);
      setSavedOffline((s) => ({ ...s, [id]: false }));
      return;
    }
    setSavingId(id);
    try {
      await saveDocumentOffline(id);
      setSavedOffline((s) => ({ ...s, [id]: true }));
    } catch {
      setError("Couldn't save that document for offline use. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-sm font-medium text-muted hover:border-brand-600 hover:text-brand-700 disabled:opacity-60"
      >
        {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
        {stage === "compressing" ? "Compressing..." : uploading ? "Uploading..." : "Upload Document"}
      </button>

      {documents.length === 0 ? (
        <p className="text-sm text-muted">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => {
            const saved = Boolean(savedOffline[doc.id]);
            const savingThis = savingId === doc.id;
            return (
              <li
                key={doc.id}
                style={tint(doc.id)}
                className="tint flex items-center gap-3 rounded-xl border px-3.5 py-3"
              >
                <FileText size={18} className="shrink-0 text-faint" />
                <button
                  type="button"
                  onClick={() => setViewingDoc(doc)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium text-ink hover:text-brand-700">{doc.name}</p>
                  <p className="text-xs text-muted">
                    {formatFileSize(doc.size)} · {formatDateTime(doc.uploadedAt)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => toggleOffline(doc.id)}
                  disabled={savingThis || (!online && !saved)}
                  aria-label={saved ? `Remove ${doc.name} from offline storage` : `Save ${doc.name} for offline`}
                  title={
                    saved
                      ? "Available offline — tap to remove"
                      : online
                        ? "Save for offline"
                        : "Requires an internet connection"
                  }
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg disabled:opacity-40 ${
                    saved ? "text-success-700 hover:bg-success-100" : "text-muted hover:bg-background hover:text-ink"
                  }`}
                >
                  {savingThis ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : saved ? (
                    <CircleCheck size={16} />
                  ) : (
                    <HardDriveDownload size={16} />
                  )}
                </button>
                <a
                  href={`/api/documents/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-ink"
                  aria-label={`Download ${doc.name}`}
                >
                  <Download size={16} />
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                  aria-label={`Delete ${doc.name}`}
                >
                  {deletingId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {viewingDoc && <DocumentViewer document={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </div>
  );
}
