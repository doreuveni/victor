import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { HeartIcon } from '@/components/icons';

interface Props {
  recipeId: string;
  initialCount: number;
}

// Optimistic like/unlike. RLS on `likes` scopes writes to the caller's own
// user_id and requires can_view_recipe, so no extra client check is needed.
export default function LikeButton({ recipeId, initialCount }: Props) {
  const { session } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('likes')
      .select('user_id')
      .eq('recipe_id', recipeId)
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [recipeId, session]);

  async function toggle() {
    if (!session || busy) return;
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    setBusy(true);
    const { error } = next
      ? await supabase.from('likes').insert({ user_id: session.user.id, recipe_id: recipeId })
      : await supabase.from('likes').delete().match({ user_id: session.user.id, recipe_id: recipeId });
    setBusy(false);
    if (error) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex min-h-11 items-center gap-1.5 text-sm transition ${liked ? 'text-danger-500' : 'hover:text-danger-500'}`}
      aria-label={liked ? 'הסר לייק' : 'לייק'}
    >
      <HeartIcon filled={liked} /> {count}
    </button>
  );
}
