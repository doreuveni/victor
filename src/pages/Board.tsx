import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useFeed, type PageFetcher } from '@/features/feed/useFeed';
import FeedList from '@/features/feed/FeedList';
import { LogoMark, FolderIcon, BookmarkIcon, EmptyBowlIcon } from '@/components/icons';
import { SQUARE_ASPECT } from '@/lib/constants';
import type { FeedCard } from '@/features/feed/types';

interface BoardHeader {
  id: string;
  name: string;
  is_default: boolean;
  is_public: boolean;
  owner_id: string;
  owner_username: string | null;
}

export default function Board() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [board, setBoard] = useState<BoardHeader | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');

  useEffect(() => {
    if (!id) return;
    setState('loading');
    supabase
      .from('collections')
      .select('id, name, is_default, is_public, owner_id, owner:profiles(username)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setState('notfound');
          return;
        }
        const owner = data.owner as unknown as { username: string | null } | null;
        setBoard({
          id: data.id,
          name: data.name,
          is_default: data.is_default,
          is_public: data.is_public,
          owner_id: data.owner_id,
          owner_username: owner?.username ?? null,
        });
        setState('ready');
      });
  }, [id]);

  const fetcher: PageFetcher = useCallback(
    async (cursor, limit) => {
      if (!id) return [];
      const { data, error } = await supabase.rpc('collection_recipes', {
        p_collection_id: id,
        p_cursor_created: cursor?.created ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as FeedCard[];
    },
    [id],
  );

  const feed = useFeed(fetcher, [id]);

  if (state === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center text-brand-500 animate-pulse">
        <LogoMark size={32} />
      </div>
    );
  }

  if (state === 'notfound' || !board) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="flex justify-center text-stone-300">
          <EmptyBowlIcon size={40} />
        </p>
        <p className="mt-3 text-stone-600">האוסף לא נמצא או שאינו זמין לך.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-sm font-medium text-brand-600">
          חזרה לגלה
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-4">
        <div className="flex items-center gap-2 text-accent-600">
          {board.is_default ? <BookmarkIcon size={22} filled /> : <FolderIcon size={22} />}
          <h1 className="text-xl font-bold text-stone-900">{board.name}</h1>
          {!board.is_public && (
            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">פרטי</span>
          )}
        </div>
        {board.owner_username && (
          <Link to={`/u/${board.owner_username}`} className="mt-1 inline-block text-sm text-stone-500">
            <span className="ltr">@{board.owner_username}</span>
          </Link>
        )}
      </div>

      <FeedList
        items={feed.items}
        status={feed.status}
        hasMore={feed.hasMore}
        loadingMore={feed.loadingMore}
        loadMore={feed.loadMore}
        view="grid"
        gridAspect={SQUARE_ASPECT}
        empty="האוסף ריק."
      />
    </div>
  );
}
