import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useScrollLock } from '@/lib/useScrollLock';
import { EditIcon, TrashIcon, SpinnerIcon } from '@/components/icons';

interface Props {
  recipeId: string;
  onClose: () => void;
}

// Bottom-sheet for the recipe owner (or admin): edit, or delete with an
// explicit confirm step. RLS on `recipes` already scopes the delete to
// author_id = auth.uid() or an admin, so no extra client-side check needed.
export default function RecipeOwnerMenu({ recipeId, onClose }: Props) {
  useScrollLock();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
    if (error) {
      setDeleting(false);
      return;
    }
    navigate('/me', { replace: true });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="pb-safe w-full max-w-lg rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-200" />

        {!confirming ? (
          <>
            <button
              onClick={() => navigate(`/r/${recipeId}/edit`)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm hover:bg-stone-50"
            >
              <EditIcon size={17} /> ערוך מתכון
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm text-danger-600 hover:bg-stone-50"
            >
              <TrashIcon size={17} /> מחק מתכון
            </button>
            <button onClick={onClose} className="mt-2 min-h-11 w-full rounded-xl bg-stone-100 py-2.5 text-sm text-stone-700 hover:bg-stone-200">
              ביטול
            </button>
          </>
        ) : (
          <>
            <p className="px-3 py-2 text-center text-sm text-stone-700">
              למחוק את המתכון? הפעולה אינה הפיכה — כל הלייקים והתגובות יימחקו יחד איתו.
            </p>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-danger-500 py-2.5 text-sm font-medium text-white transition hover:bg-danger-600 disabled:opacity-50"
            >
              {deleting ? <SpinnerIcon size={16} /> : 'כן, מחק'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="mt-2 min-h-11 w-full rounded-xl bg-stone-100 py-2.5 text-sm text-stone-700 hover:bg-stone-200"
            >
              ביטול
            </button>
          </>
        )}
      </div>
    </div>
  );
}
