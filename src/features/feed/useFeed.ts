import { useCallback, useEffect, useRef, useState } from 'react';
import { PAGE_SIZE, type FeedCard } from './types';

// Fetches one page given the keyset cursor of the last row (null on first page).
export type PageFetcher = (
  cursor: { created: string; id: string } | null,
  limit: number,
) => Promise<FeedCard[]>;

interface FeedState {
  items: FeedCard[];
  status: 'loading' | 'ready' | 'error';
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

// Keyset-paginated feed. `deps` reset the feed (e.g. search / category change).
export function useFeed(fetcher: PageFetcher, deps: unknown[] = []): FeedState {
  const [items, setItems] = useState<FeedCard[]>([]);
  const [status, setStatus] = useState<FeedState['status']>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Guards against out-of-order responses when deps change mid-flight.
  const runId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(
    async (cursor: { created: string; id: string } | null, run: number) => {
      try {
        const rows = await fetcherRef.current(cursor, PAGE_SIZE);
        if (run !== runId.current) return; // superseded
        setItems((prev) => (cursor ? [...prev, ...rows] : rows));
        setHasMore(rows.length === PAGE_SIZE);
        setStatus('ready');
      } catch {
        if (run !== runId.current) return;
        setStatus('error');
      } finally {
        if (run === runId.current) setLoadingMore(false);
      }
    },
    [],
  );

  // First page + reset when deps change.
  useEffect(() => {
    const run = ++runId.current;
    setStatus('loading');
    setItems([]);
    setHasMore(false);
    load(null, run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const last = items[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    load({ created: last.created_at, id: last.id }, runId.current);
  }, [items, hasMore, loadingMore, load]);

  return { items, status, hasMore, loadingMore, loadMore };
}
