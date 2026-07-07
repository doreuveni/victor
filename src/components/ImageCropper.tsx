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
const OUTPUT_WIDTH = 1600;
const OUTPUT_QUALITY = 0.92;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_MOVE_PX = 20;
const DOUBLE_TAP_ZOOM = 2;
const WHEEL_ZOOM_SPEED = 0.0015;
const GESTURE_END_MS = 200; // how long a wheel burst must be quiet before we treat it as "ended"

type Point = { x: number; y: number };

function clampPos(x: number, y: number, dispW: number, dispH: number, frameW: number, frameH: number): Point {
  const minX = Math.min(0, frameW - dispW);
  const minY = Math.min(0, frameH - dispH);
  return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) };
}

// Full-screen pan/zoom cropper: drag/pinch to reposition and zoom (mouse-wheel
// + drag on desktop), always covers the target aspect so the exported image is
// exactly that ratio — the user chooses the framing instead of a blind
// auto-crop. Live gesture math writes directly to the image element's style
// (bypassing React state) so pinch/drag stay smooth at event frequency;
// committed state is only updated once a gesture ends.
export default function ImageCropper({ file, aspect, onCancel, onConfirm }: Props) {
  useScrollLock();
  const frameRef = useRef<HTMLDivElement>(null);
  const imgElRef = useRef<HTMLImageElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState({ w: 300, h: 300 / aspect });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<Point>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [gesturing, setGesturing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  // Live (uncommitted) gesture state — mutated on every pointer/wheel event
  // without triggering a re-render; flushed into React state on gesture end.
  const liveZoom = useRef(1);
  const livePos = useRef<Point>({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, Point>());
  const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const wheelEndTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function requestClose(action: () => void) {
    setClosing(true);
    setTimeout(action, 180);
  }

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
    const initial = { x: (frame.w - img.width * s) / 2, y: (frame.h - img.height * s) / 2 };
    liveZoom.current = 1;
    livePos.current = initial;
    setZoom(1);
    setPos(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);

  const baseScale = img ? Math.max(frame.w / img.width, frame.h / img.height) : 1;
  const scale = baseScale * zoom;
  const dispW = img ? img.width * scale : 0;
  const dispH = img ? img.height * scale : 0;

  // Writes the live zoom/pos straight to the DOM, skipping React re-render —
  // this is what keeps pinch/drag/wheel smooth at native event frequency.
  function paintLive() {
    const el = imgElRef.current;
    if (!el || !img) return;
    const s = baseScale * liveZoom.current;
    el.style.width = `${img.width * s}px`;
    el.style.height = `${img.height * s}px`;
    el.style.transform = `translate(${livePos.current.x}px, ${livePos.current.y}px)`;
  }

  function commitLive() {
    setZoom(liveZoom.current);
    setPos(livePos.current);
  }

  // Zoom to `nextZoomRaw`, keeping `anchor` (a point in frame-local coords)
  // stationary on screen — anchor is the pinch midpoint, the cursor for wheel
  // zoom, or the double-tap point.
  function zoomAt(nextZoomRaw: number, anchor: Point) {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomRaw));
    if (!img) {
      liveZoom.current = nextZoom;
      return;
    }
    const oldScale = baseScale * liveZoom.current;
    const newScale = baseScale * nextZoom;
    const cx = (anchor.x - livePos.current.x) / oldScale;
    const cy = (anchor.y - livePos.current.y) / oldScale;
    const nx = anchor.x - cx * newScale;
    const ny = anchor.y - cy * newScale;
    livePos.current = clampPos(nx, ny, img.width * newScale, img.height * newScale, frame.w, frame.h);
    liveZoom.current = nextZoom;
    paintLive();
  }

  function framePoint(clientX: number, clientY: number): Point {
    const rect = frameRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setGesturing(true);

    if (pointers.current.size === 1) {
      pinchStart.current = null;
      dragStart.current = { x: e.clientX, y: e.clientY, posX: livePos.current.x, posY: livePos.current.y };

      const now = performance.now();
      const pt = framePoint(e.clientX, e.clientY);
      const last = lastTap.current;
      if (last && now - last.time < DOUBLE_TAP_MS && Math.hypot(pt.x - last.x, pt.y - last.y) < DOUBLE_TAP_MOVE_PX) {
        zoomAt(liveZoom.current > 1 ? MIN_ZOOM : DOUBLE_TAP_ZOOM, pt);
        lastTap.current = null;
      } else {
        lastTap.current = { time: now, x: pt.x, y: pt.y };
      }
    } else if (pointers.current.size === 2) {
      dragStart.current = null;
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: liveZoom.current };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !img) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = framePoint((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomAt(pinchStart.current.zoom * (dist / pinchStart.current.dist), mid);
      return;
    }
    if (pointers.current.size === 1 && dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const s = baseScale * liveZoom.current;
      livePos.current = clampPos(
        dragStart.current.posX + dx,
        dragStart.current.posY + dy,
        img.width * s,
        img.height * s,
        frame.w,
        frame.h,
      );
      paintLive();
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) {
      // Pinch -> single-finger pan: restart the drag baseline from here.
      const [p] = [...pointers.current.values()];
      dragStart.current = { x: p.x, y: p.y, posX: livePos.current.x, posY: livePos.current.y };
      pinchStart.current = null;
    } else if (pointers.current.size === 0) {
      dragStart.current = null;
      pinchStart.current = null;
      setGesturing(false);
      commitLive();
    }
  }

  // Wheel-zoom on desktop (mouse-wheel/trackpad), anchored at the cursor.
  // Attached as a native listener so preventDefault actually stops page
  // scroll — React's onWheel is passive by default and can't do that.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const pt = framePoint(e.clientX, e.clientY);
      zoomAt(liveZoom.current * Math.exp(-e.deltaY * WHEEL_ZOOM_SPEED), pt);
      setGesturing(true);
      clearTimeout(wheelEndTimer.current);
      wheelEndTimer.current = setTimeout(() => {
        setGesturing(false);
        commitLive();
      }, GESTURE_END_MS);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, frame.w, frame.h, baseScale]);

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
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', OUTPUT_QUALITY));
    setBusy(false);
    if (blob) requestClose(() => onConfirm(blob));
  }

  return (
    <div
      className={`fixed inset-0 z-30 flex flex-col bg-stone-900 transition-all duration-200 ${
        mounted && !closing ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-3 text-white">
        <button onClick={() => requestClose(onCancel)} className="flex min-h-11 items-center gap-1.5 px-2 text-sm">
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
          className={`relative w-full max-w-sm touch-none select-none overflow-hidden rounded-2xl bg-black transition-transform duration-200 ${
            mounted && !closing ? 'scale-100' : 'scale-95'
          }`}
          style={{ aspectRatio: aspect }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {img && (
            <img
              ref={imgElRef}
              src={img.src}
              alt=""
              draggable={false}
              className="absolute left-0 top-0 max-w-none"
              style={{ width: dispW, height: dispH, transform: `translate(${pos.x}px, ${pos.y}px)`, transformOrigin: '0 0' }}
            />
          )}

          {/* Rule-of-thirds grid — only visible while actively dragging/pinching/wheeling. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
              gesturing ? 'opacity-80' : 'opacity-0'
            }`}
          >
            <div className="absolute inset-y-0 start-1/3 w-px bg-white/70" />
            <div className="absolute inset-y-0 start-2/3 w-px bg-white/70" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/70" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/70" />
          </div>
        </div>
      </div>

      <p className="px-6 pb-safe pt-2 text-center text-xs text-stone-400">
        גררו כדי למקם, צבטו או גללו כדי להתקרב — הקישו פעמיים להתקרבות מהירה
      </p>
    </div>
  );
}
