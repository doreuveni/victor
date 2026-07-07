import { useCallback, useEffect, useRef, useState } from 'react';
import { PAGE_SIZE, type FeedCard } from './types';

export type OffsetPageFetcher = (offset: number, limit: number) => Promise<FeedCard[]>;

interface FeedState {
  items: FeedCard[];
  status: 'loading' | 'ready' | 'error';
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

// Offset-paginated counterpart to useFeed — for result sets ordered by a
// computed value (e.g. relevance score) that isn't part of any keyset cursor.
// Same shape as useFeed so it's a drop-in for FeedList; deps reset the feed.
export function useOffsetFeed(fetcher: OffsetPageFetcher, deps: unknown[] = []): FeedState {
  const [items, setItems] = useState<FeedCard[]>([]);
  const [status, setStatus] = useState<FeedState['status']>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const runId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (offset: number, run: number) => {
    try {
      const rows = await fetcherRef.current(offset, PAGE_SIZE);
      if (run !== runId.current) return;
      setItems((prev) => (offset > 0 ? [...prev, ...rows] : rows));
      setHasMore(rows.length === PAGE_SIZE);
      setStatus('ready');
    } catch {
      if (run !== runId.current) return;
      setStatus('error');
    } finally {
      if (run === runId.current) setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const run = ++runId.current;
    setStatus('loading');
    setItems([]);
    setHasMore(false);
    load(0, run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    load(items.length, runId.current);
  }, [items.length, hasMore, loadingMore, load]);

  return { items, status, hasMore, loadingMore, loadMore };
}
