import { useRef, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { uploadRecipePhoto, uploadRecipePhotoBlob } from '@/lib/storage';
import { CameraIcon, SpinnerIcon } from '@/components/icons';
import ImageCropper from '@/components/ImageCropper';

interface Props {
  onUploaded: (url: string) => void;
  /** Compact camera-icon variant, for per-step inline photos. */
  compact?: boolean;
  label?: string;
  /**
   * width/height to crop to before upload (e.g. 3/4). When set, picking a
   * file opens the pan/zoom cropper instead of uploading it as-is — lets the
   * user choose framing instead of a blind auto-crop later.
   */
  aspect?: number;
  /** Override the upload target — defaults to the recipe-photos bucket. */
  upload?: (userId: string, file: File) => Promise<string>;
  uploadBlob?: (userId: string, blob: Blob) => Promise<string>;
}

// Picks an image, runs the HEIC/compress/EXIF pipeline (and optionally a
// crop step), uploads, returns a URL.
export default function PhotoButton({
  onUploaded,
  compact,
  label,
  aspect,
  upload = uploadRecipePhoto,
  uploadBlob = uploadRecipePhotoBlob,
}: Props) {
  const { session } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || !session?.user) return;
    setError(false);
    if (aspect) {
      setPendingFile(file);
      return;
    }
    setBusy(true);
    try {
      const url = await upload(session.user.id, file);
      onUploaded(url);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleCropped(blob: Blob) {
    setPendingFile(null);
    if (!session?.user) return;
    setBusy(true);
    setError(false);
    try {
      const url = await uploadBlob(session.user.id, blob);
      onUploaded(url);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={
          compact
            ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-300 text-stone-500 hover:bg-stone-50 disabled:opacity-50'
            : 'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 py-8 text-stone-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-50'
        }
        aria-label={label ?? 'הוסף תמונה'}
      >
        {busy ? <SpinnerIcon size={compact ? 18 : 22} className="text-brand-500" /> : <CameraIcon />}
        {!compact && <span className="text-sm">{busy ? 'מעלה…' : (label ?? 'הוסף תמונה')}</span>}
      </button>
      {error && <p className="mt-1 text-xs text-danger-600">העלאה נכשלה. נסה שוב.</p>}
      {pendingFile && aspect && (
        <ImageCropper file={pendingFile} aspect={aspect} onCancel={() => setPendingFile(null)} onConfirm={handleCropped} />
      )}
    </>
  );
}
