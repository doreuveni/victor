import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { BookmarkIcon } from '@/components/icons';
import SaveModal from './SaveModal';

interface Props {
  recipeId: string;
  /** 'inline' (default): icon + label, for the detail action bar.
   *  'overlay': icon-only round button, for a card placed over a photo. */
  variant?: 'inline' | 'overlay';
}

export default function SaveButton({ recipeId, variant = 'inline' }: Props) {
  const { session } = useAuth();
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('collection_items')
      .select('collection_id, collections!inner(owner_id)')
      .eq('recipe_id', recipeId)
      .eq('collections.owner_id', session.user.id)
      .then(({ data }) => setSaved(!!data && data.length > 0));
  }, [recipeId, session]);

  function open_(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  return (
    <>
      {variant === 'overlay' ? (
        <button
          onClick={open_}
          aria-label={saved ? 'נשמר — ערוך אוספים' : 'שמור מתכון'}
          className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm backdrop-blur transition ${
            saved ? 'bg-brand-500 text-white' : 'bg-white/90 text-stone-700 hover:bg-white'
          }`}
        >
          <BookmarkIcon size={17} filled={saved} />
        </button>
      ) : (
        <button
          onClick={open_}
          className={`flex min-h-11 items-center gap-1.5 text-sm transition ${saved ? 'text-brand-600' : 'hover:text-brand-600'}`}
        >
          <BookmarkIcon filled={saved} /> {saved ? 'נשמר' : 'שמור'}
        </button>
      )}
      {open && (
        <SaveModal recipeId={recipeId} onSavedChange={setSaved} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
