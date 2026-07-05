import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useFeed, type PageFetcher } from '@/features/feed/useFeed';
import FeedList from '@/features/feed/FeedList';
import type { FeedCard } from '@/features/feed/types';

export default function Following() {
  const fetcher: PageFetcher = useCallback(async (cursor, limit) => {
    const { data, error } = await supabase.rpc('feed_following', {
      p_cursor_created: cursor?.created ?? null,
      p_cursor_id: cursor?.id ?? null,
      p_limit: limit,
    });
    if (error) throw error;
    return (data ?? []) as FeedCard[];
  }, []);

  const feed = useFeed(fetcher);

  return (
    <div className="px-4 py-4">
      <h1 className="mb-4 text-xl font-bold">עוקב</h1>
      <FeedList
        items={feed.items}
        status={feed.status}
        hasMore={feed.hasMore}
        loadingMore={feed.loadingMore}
        loadMore={feed.loadMore}
        empty="הפיד ריק. עקוב אחרי מבשלים כדי לראות את המתכונים שלהם כאן."
      />
    </div>
  );
}
