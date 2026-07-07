import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useScrollLock } from '@/lib/useScrollLock';
import { CameraIcon, SpinnerIcon, TrashIcon, XIcon } from '@/components/icons';
import { importRecipeFromPhotos, MAX_IMPORT_IMAGES } from './importRecipe';
import type { AiImportError } from './types';

const ERROR_MESSAGES: Record<AiImportError, string> = {
  daily_limit_reached: 'הגענו למכסת הייבוא היומית. נסו שוב מחר.',
  not_found: 'לא הצלחנו לזהות מתכון בתמונות האלה. נסו תמונה ברורה יותר.',
  failed: 'הייבוא נכשל. נסו שוב.',
};

interface Props {
  onCancel: () => void;
}

// Full-screen flow: pick up to MAX_IMPORT_IMAGES photos -> send to the
// ai-recipe-import edge function -> prefill recipe_drafts -> land in the
// existing create wizard for review, same as manual entry.
export default function ImportFromPhotos({ onCancel }: Props) {
  useScrollLock();
  const { session } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const userId = session!.user.id;

  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_IMPORT_IMAGES));
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleImport() {
    setBusy(true);
    setError(null);
    const result = await importRecipeFromPhotos(files);
    if (!result.ok) {
      setBusy(false);
      setError(ERROR_MESSAGES[result.error]);
      return;
    }
    const { error: saveErr } = await supabase
      .from('recipe_drafts')
      .upsert({ owner_id: userId, data: result.draft, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
    if (saveErr) {
      setBusy(false);
      setError(ERROR_MESSAGES.failed);
      return;
    }
    navigate('/create/new');
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-white">
      <div className="flex items-center justify-between px-3 py-3">
        <button onClick={onCancel} className="flex min-h-11 items-center gap-1.5 px-2 text-sm text-stone-600">
          <XIcon size={16} /> ביטול
        </button>
        <h2 className="text-sm font-semibold text-stone-900">ייבוא מתמונה</h2>
        <span className="w-14" />
      </div>

      {busy ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <SpinnerIcon size={32} className="text-brand-500" />
          <p className="text-sm text-stone-600">קוראים את המתכון…</p>
          <button onClick={onCancel} className="mt-2 min-h-11 text-sm text-stone-500 hover:text-danger-500">
            ביטול
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 px-4 py-4">
          <p className="text-sm text-stone-500">
            בחרו עד {MAX_IMPORT_IMAGES} תמונות — צילום מסך, עמוד מתכון, או כרטיסייה כתובה ביד.
          </p>

          {files.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-stone-100">
                  <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => removeFile(i)}
                    aria-label="הסר"
                    className="absolute end-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {files.length < MAX_IMPORT_IMAGES && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 py-8 text-stone-500 hover:border-brand-400 hover:text-brand-600"
            >
              <CameraIcon size={22} />
              <span className="text-sm">הוסיפו תמונות</span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePick}
          />

          {error && <p className="text-sm text-danger-600">{error}</p>}

          <div className="flex-1" />
          <button
            onClick={handleImport}
            disabled={files.length === 0}
            className="min-h-11 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
          >
            ייבוא
          </button>
        </div>
      )}
    </div>
  );
}
