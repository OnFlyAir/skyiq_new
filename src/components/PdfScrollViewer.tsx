import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";

interface PdfScrollViewerProps {
  src: string;
  title: string;
  className?: string;
}

export default function PdfScrollViewer({ src, title, className = "" }: PdfScrollViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => setContainerWidth(Math.floor(el.clientWidth));
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!src || containerWidth < 120) return;

    let cancelled = false;
    let loadingTask: { promise: Promise<unknown>; destroy?: () => void } | null = null;
    let pdfDocument: { numPages: number; getPage: (pageNumber: number) => Promise<unknown>; destroy?: () => void } | null = null;
    const renderTasks: Array<{ promise: Promise<unknown>; cancel?: () => void }> = [];

    const waitForCanvasMount = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    async function renderPdf() {
      setLoading(true);
      setError(false);
      setPageCount(0);
      canvasRefs.current = {};

      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();

      loadingTask = pdfjsLib.getDocument(src);
      pdfDocument = (await loadingTask.promise) as typeof pdfDocument;
      if (cancelled || !pdfDocument) return;

      setPageCount(pdfDocument.numPages);
      await waitForCanvasMount();

      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        if (cancelled) return;

        const page = (await pdfDocument.getPage(pageNumber)) as {
          getViewport: (options: { scale: number }) => { width: number; height: number };
          render: (options: {
            canvasContext: CanvasRenderingContext2D;
            viewport: { width: number; height: number };
          }) => { promise: Promise<unknown>; cancel?: () => void };
        };
        const canvas = canvasRefs.current[pageNumber];
        const context = canvas?.getContext("2d");
        if (!canvas || !context) continue;

        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(120, containerWidth - 24);
        const scale = availableWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        const renderTask = page.render({ canvasContext: context, viewport });
        renderTasks.push(renderTask);
        await renderTask.promise;
      }

      if (!cancelled) setLoading(false);
    }

    renderPdf().catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      renderTasks.forEach((task) => task.cancel?.());
      loadingTask?.destroy?.();
      pdfDocument?.destroy?.();
    };
  }, [containerWidth, src]);

  return (
    <div ref={containerRef} className={`relative h-full overflow-y-auto bg-muted/30 ${className}`}>
      {pageCount > 0 && (
        <div className="flex flex-col items-center gap-3 p-3">
          {Array.from({ length: pageCount }, (_, index) => {
            const pageNumber = index + 1;
            return (
              <canvas
                key={pageNumber}
                ref={(el) => {
                  canvasRefs.current[pageNumber] = el;
                }}
                aria-label={`${title} page ${pageNumber}`}
                className="max-w-full rounded-sm border bg-background shadow-sm"
              />
            );
          })}
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="text-center text-muted-foreground">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <p className="text-xs">Loading PDF...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex h-full items-center justify-center p-6 text-center">
          <div>
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">PDF preview unavailable</p>
            <a href={src} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm text-primary underline-offset-4 hover:underline">
              Open PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}