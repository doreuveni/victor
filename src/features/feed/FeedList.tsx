import { useEffect, useRef } from 'react';
import RecipeCard from './RecipeCard';
import RecipeGridCard from './RecipeGridCard';
import type { FeedCard } from './types';

interface Props {
  items: FeedCard[];
  status: 'loading' | 'ready' | 'error';
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  empty: string;
  /** shown once the list is exhausted (hasMore=false); defaults to a generic line. */
  endMessage?: string;
  /** 'list' (default): one full-width column. 'grid': uniform 3-column tiles. */
  view?: 'list' | 'grid';
  /** width/height for grid tiles — ignored in list view. */
  gridAspect?: number;
}

// Renders a feed with infinite scroll (IntersectionObserver + manual fallback).
export default function FeedList({
  items,
  status,
  hasMore,
  loadingMore,
  loadMore,
  empty,
  endMessage = '— זהו הכול —',
  view = 'list',
  gridAspect = 1,
}: Props) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && loadMore(),
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  if (status === 'loading') {
    if (view === 'grid') {
      return (
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-stone-100" style={{ aspectRatio: gridAspect }} />
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-stone-100 p-3">
            <div className="aspect-[4/3] rounded-xl bg-stone-100" />
            <div className="mt-3 h-4 w-2/3 rounded bg-stone-100" />
            <div className="mt-2 h-3 w-1/3 rounded bg-stone-100" />
          </div>
        ))}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="py-16 text-center text-sm text-stone-500">
        טעינת הפיד נכשלה.
        <button onClick={loadMore} className="ms-1 font-medium text-brand-600">
          נסה שוב
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="py-16 text-center text-sm text-stone-500">{empty}</p>;
  }

  return (
    <>
      {view === 'grid' ? (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((card) => (
            <RecipeGridCard key={card.id} card={card} aspect={gridAspect} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((card) => (
            <RecipeCard key={card.id} card={card} />
          ))}
        </div>
      )}
      <div ref={sentinel} className="h-8" />
      {loadingMore && <p className="py-3 text-center text-sm text-stone-500 animate-pulse">טוען עוד…</p>}
      {!hasMore && items.length > 0 && <p className="py-6 text-center text-xs text-stone-400">{endMessage}</p>}
    </>
  );
}
