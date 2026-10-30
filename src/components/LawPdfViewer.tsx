"use client";

import { useEffect, useRef, useState } from "react";
import { X, ExternalLink, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export function LawPdfViewer({
  actName,
  sectionLabel,
  fileUrl,
  page,
  onClose,
}: {
  actName: string;
  sectionLabel?: string;
  fileUrl: string;
  page: number;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<import("pdfjs-dist").PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [currentPage, setCurrentPage] = useState(page);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
        loadingTaskRef.current = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setStatus("ready");
      } catch (err) {
        console.error("Failed to load PDF", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
      pdfDocRef.current = null;
    };
     
  }, [fileUrl]);

  useEffect(() => {
    if (status !== "ready" || !pdfDocRef.current || !canvasRef.current) return;

    let cancelled = false;

    (async () => {
      const doc = pdfDocRef.current!;
      const clampedPage = Math.min(Math.max(currentPage, 1), doc.numPages);
      const pdfPage = await doc.getPage(clampedPage);
      if (cancelled) return;

      const canvas = canvasRef.current!;
      const context = canvas.getContext("2d");
      if (!context) return;

      const containerWidth = containerRef.current?.clientWidth ?? 800;
      const unscaledViewport = pdfPage.getViewport({ scale: 1 });
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const scale = (Math.min(containerWidth, 900) / unscaledViewport.width) * dpr;
      const viewport = pdfPage.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      renderTaskRef.current?.cancel();
      const renderTask = pdfPage.render({ canvas, canvasContext: context, viewport });
      renderTaskRef.current = renderTask;
      try {
        await renderTask.promise;
      } catch {
        // render was cancelled (e.g. page changed mid-render) — ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, currentPage]);

  function goTo(p: number) {
    if (!numPages) return;
    setCurrentPage(Math.min(Math.max(p, 1), numPages));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/60 backdrop-blur-sm sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface sm:rounded-2xl sm:shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{actName}</p>
            {sectionLabel && <p className="truncate text-xs text-muted">{sectionLabel}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-background"
              aria-label="Open original PDF"
              title="Open original PDF"
            >
              <ExternalLink size={17} />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-background"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div ref={containerRef} className="min-h-0 flex-1 overflow-auto bg-background px-2 py-4">
          {status === "loading" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
              <Loader2 size={22} className="animate-spin" />
              <p className="text-sm">Loading page {page}...</p>
            </div>
          )}
          {status === "error" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted">
              <p className="text-sm font-semibold text-ink">Couldn&apos;t load the PDF preview</p>
              <p className="text-sm">
                Use the{" "}
                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600">
                  open original PDF
                </a>{" "}
                button above instead.
              </p>
            </div>
          )}
          <canvas ref={canvasRef} className={`mx-auto block rounded-lg shadow-card ${status === "ready" ? "" : "hidden"}`} />
        </div>

        {status === "ready" && numPages && (
          <div className="flex shrink-0 items-center justify-center gap-3 border-t border-line px-4 py-2.5">
            <button
              type="button"
              onClick={() => goTo(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-background disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs font-medium text-muted">
              Page {currentPage} of {numPages}
            </span>
            <button
              type="button"
              onClick={() => goTo(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-background disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
