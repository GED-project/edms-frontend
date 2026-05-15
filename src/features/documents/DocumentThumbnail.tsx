/**
 * DocumentThumbnail — lazy-loaded document preview thumbnail for list/grid cards.
 *
 * - image files  → fetches /thumbnail/{id} (raw image bytes) and renders <img>
 * - pdf files    → fetches /file/{id} then renders page 1 to a <canvas> via PDF.js
 * - other files  → styled file-type icon (no network call)
 *
 * All fetches are deferred until the element enters the viewport (IntersectionObserver),
 * so cards off-screen don't trigger requests on load.
 */
import { useEffect, useRef, useState } from 'react';
import { FileText, FileSpreadsheet, FileImage, File, Folder } from 'lucide-react';
import * as docService from './document.service';

// ─── PDF.js (lazy-imported to avoid loading the worker on every page) ─────────
let _pdfjs: typeof import('pdfjs-dist') | null = null;
async function getPdfJs() {
  if (_pdfjs) return _pdfjs;
  const mod = await import('pdfjs-dist');
  // Vite resolves ?url imports at build time — use CDN worker URL as fallback
  mod.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  _pdfjs = mod;
  return mod;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type DocType = 'folder' | 'pdf' | 'excel' | 'image' | 'other';

interface DocumentThumbnailProps {
  docId: string;
  docType: DocType;
  docName?: string;
  className?: string;
}

// ─── Icon fallback map ────────────────────────────────────────────────────────
const TYPE_ICON: Record<DocType, React.ElementType> = {
  folder: Folder,
  pdf: FileText,
  excel: FileSpreadsheet,
  image: FileImage,
  other: File,
};

const TYPE_ICON_COLOR: Record<DocType, string> = {
  folder: 'text-amber-500',
  pdf:    'text-red-500',
  excel:  'text-emerald-500',
  image:  'text-purple-500',
  other:  'text-blue-500',
};

const TYPE_BG: Record<DocType, string> = {
  folder: 'bg-amber-500/10',
  pdf:    'bg-red-500/10',
  excel:  'bg-emerald-500/10',
  image:  'bg-purple-500/10',
  other:  'bg-blue-500/10',
};

// ─── Component ────────────────────────────────────────────────────────────────
export function DocumentThumbnail({
  docId,
  docType,
  docName = '',
  className = '',
}: DocumentThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [pdfRendered, setPdfRendered] = useState(false);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(false);

  // ── 1. Watch visibility ───────────────────────────────────────────────────
  useEffect(() => {
    if (docType === 'folder' || docType === 'excel' || docType === 'other') return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '100px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [docType]);

  // ── 2a. Image → fetch thumbnail endpoint ─────────────────────────────────
  useEffect(() => {
    if (!visible || docType !== 'image') return;
    let revoked = false;
    docService.getThumbnailBlobUrl(docId)
      .then((url) => {
        if (revoked) { if (url) URL.revokeObjectURL(url); return; }
        if (url) setImgSrc(url);
        else setError(true);
      })
      .catch(() => setError(true));
    return () => { revoked = true; };
  }, [visible, docId, docType]);

  // ── 2b. PDF → fetch file then render page 1 via PDF.js ───────────────────
  useEffect(() => {
    if (!visible || docType !== 'pdf') return;
    let cancelled = false;
    let blobUrl: string | null = null;

    (async () => {
      try {
        blobUrl = await docService.getFileBlob(docId);
        if (cancelled) return;

        const pdfjs = await getPdfJs();
        if (cancelled) return;

        const pdf = await pdfjs.getDocument(blobUrl).promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale: 0.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        if (!cancelled) setPdfRendered(true);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, docId, docType]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const Icon = TYPE_ICON[docType];

  // Fallback icon (folder, excel, other, or load error)
  const showIcon = docType === 'folder' || docType === 'excel' || docType === 'other' || error
    || (docType === 'image' && !imgSrc && visible)
    || (docType === 'pdf' && !pdfRendered && visible);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center overflow-hidden rounded-xl ${className}`}
    >
      {/* Real image thumbnail */}
      {docType === 'image' && imgSrc && !error && (
        <img
          src={imgSrc}
          alt={docName}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      )}

      {/* PDF canvas thumbnail */}
      {docType === 'pdf' && !error && (
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-contain ${pdfRendered ? 'block' : 'hidden'}`}
          style={{ imageRendering: 'crisp-edges' }}
        />
      )}

      {/* Loading shimmer for pdf/image while fetching */}
      {(docType === 'pdf' || docType === 'image') && !error && visible &&
        ((docType === 'pdf' && !pdfRendered) || (docType === 'image' && !imgSrc)) && (
        <div className="absolute inset-0 bg-accent/30 animate-pulse rounded-xl" />
      )}

      {/* Fallback icon */}
      {showIcon && (
        <div className={`flex h-full w-full items-center justify-center rounded-xl ${TYPE_BG[docType]}`}>
          <Icon className={`h-8 w-8 ${TYPE_ICON_COLOR[docType]}`} />
        </div>
      )}
    </div>
  );
}
