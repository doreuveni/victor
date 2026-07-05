import { useEffect, useRef, useState } from 'react';
import { decodeToImage } from '@/lib/images';
import { useScrollLock } from '@/lib/useScrollLock';
import { SpinnerIcon, XIcon } from './icons';

interface Props {
  file: File;
  /** width / height of the crop frame, e.g. 3/4 for portrait. */
  aspect: number;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const OUTPUT_WIDTH = 1000;

function clampPos(x: number, y: number, dispW: number, dispH: number, frameW: number, frameH: number) {
  const minX = Math.min(0, frameW - dispW);
  const minY = Math.min(0, frameH - dispH);
  return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) };
}

// Full-screen pan/zoom cropper: drag to reposition, slider to zoom, always
// covers the target aspect so the exported image is exactly that ratio —
// the user chooses the framing instead of a blind auto-crop.
export default function ImageCropper({ file, aspect, onCancel, onConfirm }: Props) {
  useScrollLock();
  const frameRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState({ w: 300, h: 300 / aspect });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  // Measure the frame's real rendered size (it's laid out via CSS aspect-ratio + w-full).
  useEffect(() => {
    function measure() {
      const w = frameRef.current?.clientWidth ?? 300;
      setFrame({ w, h: w / aspect });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [aspect]);

  // Decode the picked file once; revoke its object URL when the cropper closes.
  useEffect(() => {
    let cancelled = false;
    decodeToImage(file).then((el) => {
      if (!cancelled) setImg(el);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    return () => {
      if (img) URL.revokeObjectURL(img.src);
    };
  }, [img]);

  // Center the image at zoom=1 as soon as it (or the frame) is ready.
  useEffect(() => {
    if (!img) return;
    const s = Math.max(frame.w / img.width, frame.h / img.height);
    setZoom(1);
    setPos({ x: (frame.w - img.width * s) / 2, y: (frame.h - img.height * s) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);

  const baseScale = img ? Math.max(frame.w / img.width, frame.h / img.height) : 1;
  const scale = baseScale * zoom;
  const dispW = img ? img.width * scale : 0;
  const dispH = img ? img.height * scale : 0;

  function handleZoom(nextZoom: number) {
    if (!img) {
      setZoom(nextZoom);
      return;
    }
    const oldScale = baseScale * zoom;
    const newScale = baseScale * nextZoom;
    setPos((p) => {
      // Keep whatever point is at the frame's center still centered after zooming.
      const cx = (frame.w / 2 - p.x) / oldScale;
      const cy = (frame.h / 2 - p.y) / oldScale;
      const nx = frame.w / 2 - cx * newScale;
      const ny = frame.h / 2 - cy * newScale;
      return clampPos(nx, ny, img.width * newScale, img.height * newScale, frame.w, frame.h);
    });
    setZoom(nextZoom);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, posX: pos.x, posY: pos.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !img) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    setPos(clampPos(drag.current.posX + dx, drag.current.posY + dy, dispW, dispH, frame.w, frame.h));
  }
  function onPointerUp() {
    drag.current = null;
  }

  async function handleConfirm() {
    if (!img || busy) return;
    setBusy(true);
    const cropX = -pos.x / scale;
    const cropY = -pos.y / scale;
    const cropW = frame.w / scale;
    const cropH = frame.h / scale;
    const outW = OUTPUT_WIDTH;
    const outH = Math.round(OUTPUT_WIDTH / aspect);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setBusy(false);
      return;
    }
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    setBusy(false);
    if (blob) onConfirm(blob);
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-stone-900">
      <div className="flex items-center justify-between px-3 py-3 text-white">
        <button onClick={onCancel} className="flex min-h-11 items-center gap-1.5 px-2 text-sm">
          <XIcon size={16} /> ביטול
        </button>
        <h2 className="text-sm font-semibold">מיקום ותקריב</h2>
        <button
          onClick={handleConfirm}
          disabled={!img || busy}
          className="min-h-11 px-2 text-sm font-semibold text-brand-400 disabled:opacity-40"
        >
          {busy ? <SpinnerIcon size={18} /> : 'אישור'}
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden px-5">
        <div
          ref={frameRef}
          className="relative w-full max-w-sm touch-none select-none overflow-hidden rounded-2xl bg-black"
          style={{ aspectRatio: aspect }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {img && (
            <img
              src={img.src}
              alt=""
              draggable={false}
              className="absolute start-0 top-0 max-w-none"
              style={{ width: dispW, height: dispH, transform: `translate(${pos.x}px, ${pos.y}px)`, transformOrigin: '0 0' }}
            />
          )}
        </div>
      </div>

      <div className="px-6 pb-safe pt-2">
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => handleZoom(parseFloat(e.target.value))}
          className="w-full accent-brand-500"
          aria-label="תקריב"
        />
        <p className="mb-2 mt-1 text-center text-xs text-stone-400">גרור כדי למקם, החלק כדי להתקרב</p>
      </div>
    </div>
  );
}
