import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { formatRelative } from '@/lib/time';
import Avatar from '@/components/Avatar';
import { XIcon } from '@/components/icons';
import ReportButton from '@/features/reports/ReportButton';
import type { Comment } from './types';

interface Props {
  recipeId: string;
  recipeOwnerId: string;
  onCountChange: (delta: number) => void;
}

const SELECT = 'id, recipe_id, author_id, body, created_at, author:profiles ( username, display_name, avatar_url )';

export default function CommentsSection({ recipeId, recipeOwnerId, onCountChange }: Props) {
  const { session, profile } = useAuth();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    supabase
      .from('comments')
      .select(SELECT)
      .eq('recipe_id', recipeId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setComments((data ?? []) as unknown as Comment[]));
  }, [recipeId]);

  async function post() {
    const text = body.trim();
    if (!text || !session || posting) return;
    setPosting(true);
    const { data, error } = await supabase
      .from('comments')
      .insert({ recipe_id: recipeId, author_id: session.user.id, body: text })
      .select(SELECT)
      .single();
    setPosting(false);
    if (error || !data) return;
    setComments((prev) => [...(prev ?? []), data as unknown as Comment]);
    setBody('');
    onCountChange(1);
  }

  async function remove(id: string) {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) return;
    setComments((prev) => (prev ?? []).filter((c) => c.id !== id));
    onCountChange(-1);
  }

  const canDelete = (c: Comment) =>
    c.author_id === session?.user.id || recipeOwnerId === session?.user.id || !!profile?.is_admin;

  return (
    <section>
      <h2 className="mb-2 text-lg font-bold">תגובות</h2>

      {comments === null ? (
        <p className="py-4 text-center text-sm text-stone-500 animate-pulse">טוען…</p>
      ) : comments.length === 0 ? (
        <p className="py-4 text-sm text-stone-500">אין עדיין תגובות. היה הראשון להגיב.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar url={c.author?.avatar_url} name={c.author?.display_name || c.author?.username} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <Link to={`/u/${c.author?.username}`} className="text-sm font-semibold hover:underline">
                    {c.author?.display_name || c.author?.username || 'משתמש'}
                  </Link>
                  <span className="text-xs text-stone-400">{formatRelative(c.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-stone-800">{c.body}</p>
              </div>
              <div className="flex shrink-0 items-start gap-2 self-start">
                {c.author_id !== session?.user.id && <ReportButton targetType="comment" targetId={c.id} />}
                {canDelete(c) && (
                  <button
                    onClick={() => remove(c.id)}
                    className="flex h-11 w-11 items-center justify-center text-stone-300 hover:text-danger-500"
                    aria-label="מחק תגובה"
                  >
                    <XIcon size={15} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && post()}
          placeholder="הוסף תגובה…"
          className="min-h-11 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <button
          onClick={post}
          disabled={!body.trim() || posting}
          className="min-h-11 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
        >
          שלח
        </button>
      </div>
    </section>
  );
}
