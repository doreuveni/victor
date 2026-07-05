import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useFeed, type PageFetcher } from '@/features/feed/useFeed';
import FeedList from '@/features/feed/FeedList';
import { SearchIcon, GridIcon, ListIcon } from '@/components/icons';
import { COVER_ASPECT } from '@/lib/constants';
import type { FeedCard } from '@/features/feed/types';
import type { Category } from '@/lib/types';

type View = 'list' | 'grid';
const VIEW_KEY = 'feed-view';

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>(() => (localStorage.getItem(VIEW_KEY) as View) || 'grid');

  useEffect(() => localStorage.setItem(VIEW_KEY, view), [view]);

  // Category chips.
  useEffect(() => {
    supabase
      .from('categories')
      .select('id, slug, name_he, position')
      .order('position')
      .then(({ data }) => setCategories((data ?? []) as Category[]));
  }, []);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setSearch(input.trim()), 350);
    return () => clearTimeout(t);
  }, [input]);

  const fetcher: PageFetcher = useCallback(
    async (cursor, limit) => {
      const { data, error } = await supabase.rpc('feed_explore', {
        p_cursor_created: cursor?.created ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_limit: limit,
        p_search: search || null,
        p_category: category,
      });
      if (error) throw error;
      return (data ?? []) as FeedCard[];
    },
    [search, category],
  );

  const feed = useFeed(fetcher, [search, category]);

  return (
    <div className="px-4 py-4">
      {/* Search */}
      <div className="relative mb-3">
        <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-stone-400">
          <SearchIcon size={17} />
        </span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="חיפוש מתכונים…"
          className="min-h-11 w-full rounded-xl border border-stone-300 py-2.5 pe-3 ps-9 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Category chips + list/grid toggle */}
      <div className="-mx-4 mb-4 flex items-center gap-2 px-4">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            הכול
          </Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
              {c.name_he}
            </Chip>
          ))}
        </div>
        <div className="flex shrink-0 gap-0.5 rounded-full bg-stone-100 p-1">
          <ToggleBtn active={view === 'grid'} label="תצוגת רשת" onClick={() => setView('grid')}>
            <GridIcon size={15} />
          </ToggleBtn>
          <ToggleBtn active={view === 'list'} label="תצוגת רשימה" onClick={() => setView('list')}>
            <ListIcon size={15} />
          </ToggleBtn>
        </div>
      </div>

      <FeedList
        items={feed.items}
        status={feed.status}
        hasMore={feed.hasMore}
        loadingMore={feed.loadingMore}
        loadMore={feed.loadMore}
        view={view}
        gridAspect={COVER_ASPECT}
        empty={search || category ? 'לא נמצאו מתכונים תואמים.' : 'אין עדיין מתכונים. היה הראשון לפרסם!'}
        endMessage="אין יותר מתכונים חדשים לכו להכין"
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-11 shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

function ToggleBtn({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
        active ? 'bg-white text-brand-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'
      }`}
    >
      {children}
    </button>
  );
}
