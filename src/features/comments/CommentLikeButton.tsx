import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { HeartIcon } from '@/components/icons';

interface Props {
  commentId: string;
  initialCount: number;
}

// Same optimistic like/unlike pattern as the recipe-level LikeButton, scoped
// to comment_likes instead of likes.
export default function CommentLikeButton({ commentId, initialCount }: Props) {
  const { session } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('comment_likes')
      .select('user_id')
      .eq('comment_id', commentId)
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [commentId, session]);

  async function toggle() {
    if (!session || busy) return;
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    setBusy(true);
    const { error } = next
      ? await supabase.from('comment_likes').insert({ user_id: session.user.id, comment_id: commentId })
      : await supabase.from('comment_likes').delete().match({ user_id: session.user.id, comment_id: commentId });
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
      className={`flex min-h-11 items-center gap-1 text-xs transition ${liked ? 'text-danger-500' : 'text-stone-400 hover:text-danger-500'}`}
      aria-label={liked ? 'הסר לייק' : 'לייק'}
    >
      <HeartIcon size={14} filled={liked} /> {count > 0 && count}
    </button>
  );
}
