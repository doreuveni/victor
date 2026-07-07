import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { formatRelative } from '@/lib/time';
import Avatar from '@/components/Avatar';
import { XIcon } from '@/components/icons';
import CommentLikeButton from './CommentLikeButton';
import MentionInput from './MentionInput';
import type { Comment } from './types';

interface Props {
  recipeId: string;
  recipeOwnerId: string;
  onCountChange: (delta: number) => void;
}

// profiles!comments_author_id_fkey — explicit FK name required since
// comment_likes (also FK'd to profiles) gives PostgREST a second path from
// comments to profiles; a bare "profiles" embed is now ambiguous (PGRST201).
const SELECT =
  'id, recipe_id, author_id, parent_comment_id, body, like_count, created_at, author:profiles!comments_author_id_fkey ( username, display_name, avatar_url )';

const MENTION_RE = /@([a-zA-Z0-9_]{3,20})/g;

// Turns "@username" tokens into links to that user's profile. Renders any
// well-formed handle as a link (matching the DB's extraction regex) rather
// than re-querying which ones are real — same tradeoff most comment UIs make.
function renderBody(body: string) {
  const parts = body.split(MENTION_RE);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Link key={i} to={`/u/${part.toLowerCase()}`} className="font-medium text-brand-600 hover:underline">
        @{part}
      </Link>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export default function CommentsSection({ recipeId, recipeOwnerId, onCountChange }: Props) {
  const { session, profile } = useAuth();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  useEffect(() => {
    setLoadError(false);
    supabase
      .from('comments')
      .select(SELECT)
      .eq('recipe_id', recipeId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(
            `comments select failed: code=${error.code} message=${error.message} details=${error.details} hint=${error.hint}`,
          );
          setLoadError(true);
          return;
        }
        setComments(data as unknown as Comment[]);
      });
  }, [recipeId]);

  const { topLevel, repliesByParent } = useMemo(() => {
    const top: Comment[] = [];
    const replies: Record<string, Comment[]> = {};
    for (const c of comments ?? []) {
      if (c.parent_comment_id) (replies[c.parent_comment_id] ??= []).push(c);
      else top.push(c);
    }
    return { topLevel: top, repliesByParent: replies };
  }, [comments]);

  async function post() {
    const text = body.trim();
    if (!text || !session || posting) return;
    setPosting(true);
    const { data, error } = await supabase
      .from('comments')
      .insert({
        recipe_id: recipeId,
        author_id: session.user.id,
        body: text,
        parent_comment_id: replyTo?.parent_comment_id ?? replyTo?.id ?? null,
      })
      .select(SELECT)
      .single();
    setPosting(false);
    if (error || !data) return;
    setComments((prev) => [...(prev ?? []), data as unknown as Comment]);
    setBody('');
    setReplyTo(null);
    onCountChange(1);
  }

  async function remove(id: string) {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) return;
    setComments((prev) => (prev ?? []).filter((c) => c.id !== id && c.parent_comment_id !== id));
    onCountChange(-1);
  }

  const canDelete = (c: Comment) =>
    c.author_id === session?.user.id || recipeOwnerId === session?.user.id || !!profile?.is_admin;

  // Matches Instagram's comment layout exactly: username inline with the
  // comment text on the first line; timestamp + reply link on a second line
  // below it; the like heart (with its count stacked underneath, not beside
  // it) sits in its own column at the row's outer edge, vertically aligned
  // with the first line — not grouped with timestamp/reply at all.
  function CommentRow({ c, isReply }: { c: Comment; isReply?: boolean }) {
    return (
      <li className={`flex gap-2.5 ${isReply ? 'ms-9 mt-3' : ''}`}>
        <Avatar url={c.author?.avatar_url} name={c.author?.display_name || c.author?.username} size={isReply ? 26 : 32} />
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap break-words text-stone-800">
            <Link to={`/u/${c.author?.username}`} className="font-semibold hover:underline">
              {c.author?.display_name || c.author?.username || 'משתמש'}
            </Link>{' '}
            {renderBody(c.body)}
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs text-stone-400">
            <span>{formatRelative(c.created_at)}</span>
            <button onClick={() => setReplyTo(c)} className="min-h-11 font-semibold text-stone-500 hover:text-brand-600">
              הגב
            </button>
          </div>
        </div>
        {canDelete(c) && (
          <button
            onClick={() => remove(c.id)}
            className="flex h-11 w-11 shrink-0 items-center justify-center self-start text-stone-300 hover:text-danger-500"
            aria-label="מחק תגובה"
          >
            <XIcon size={15} />
          </button>
        )}
        <div className="shrink-0 self-start">
          <CommentLikeButton commentId={c.id} initialCount={c.like_count} />
        </div>
      </li>
    );
  }

  return (
    <section>
      <h2 className="mb-2 text-lg font-bold">תגובות</h2>

      {loadError ? (
        <p className="py-4 text-sm text-danger-600">טעינת התגובות נכשלה. נסה לרענן את הדף.</p>
      ) : comments === null ? (
        <p className="py-4 text-center text-sm text-stone-500 animate-pulse">טוען…</p>
      ) : topLevel.length === 0 ? (
        <p className="py-4 text-sm text-stone-500">אין עדיין תגובות. היה הראשון להגיב.</p>
      ) : (
        <ul className="space-y-3">
          {topLevel.map((c) => (
            <Fragment key={c.id}>
              <CommentRow c={c} />
              {(repliesByParent[c.id] ?? []).map((r) => (
                <CommentRow key={r.id} c={r} isReply />
              ))}
            </Fragment>
          ))}
        </ul>
      )}

      <div className="mt-4">
        {replyTo && (
          <div className="mb-1.5 flex items-center gap-2 text-xs text-stone-500">
            <span>
              עונה ל<span className="font-medium">{replyTo.author?.display_name || replyTo.author?.username}</span>
            </span>
            <button onClick={() => setReplyTo(null)} className="text-stone-400 hover:text-danger-500">
              <XIcon size={11} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <MentionInput value={body} onChange={setBody} onSubmit={post} placeholder="הוסף תגובה…" />
          <button
            onClick={post}
            disabled={!body.trim() || posting}
            className="min-h-11 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
          >
            שלח
          </button>
        </div>
      </div>
    </section>
  );
}
