import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useOffsetFeed, type OffsetPageFetcher } from '@/features/feed/useOffsetFeed';
import FeedList from '@/features/feed/FeedList';
import PersonRow from '@/features/search/PersonRow';
import { SearchIcon } from '@/components/icons';
import { COVER_ASPECT } from '@/lib/constants';
import type { FeedCard } from '@/features/feed/types';
import type { SearchProfile } from '@/features/search/types';

type Tab = 'recipes' | 'people';

export default function Search() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('recipes');
  const [people, setPeople] = useState<SearchProfile[] | null>(null);

  // Debounce the search box (same 350ms as Home's filter).
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(t);
  }, [input]);

  const recipeFetcher: OffsetPageFetcher = useCallback(
    async (offset, limit) => {
      if (!query) return [];
      const { data, error } = await supabase.rpc('search_recipes', {
        p_query: query,
        p_offset: offset,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as FeedCard[];
    },
    [query],
  );
  const recipeFeed = useOffsetFeed(recipeFetcher, [query]);

  // People search has no keyset pagination (capped top-N) — plain fetch per query.
  useEffect(() => {
    if (tab !== 'people' || !query) {
      setPeople(null);
      return;
    }
    let cancelled = false;
    supabase
      .rpc('search_profiles', { p_query: query })
      .then(({ data }) => {
        if (!cancelled) setPeople((data ?? []) as SearchProfile[]);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, query]);

  return (
    <div className="px-4 py-4">
      <div className="relative mb-3">
        <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-stone-400">
          <SearchIcon size={17} />
        </span>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="חפש לפי שם מתכון, מרכיב או משתמש…"
          className="min-h-11 w-full rounded-xl border border-stone-300 py-2.5 pe-3 ps-9 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="flex gap-2 border-b border-stone-100">
        <TabButton active={tab === 'recipes'} onClick={() => setTab('recipes')}>
          מתכונים
        </TabButton>
        <TabButton active={tab === 'people'} onClick={() => setTab('people')}>
          אנשים
        </TabButton>
      </div>

      <div className="mt-4">
        {!query ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-stone-400">
            <SearchIcon size={32} />
            <p className="text-sm text-stone-500">חפש לפי שם מתכון, מרכיב (למשל "צנון") או שם משתמש</p>
          </div>
        ) : tab === 'recipes' ? (
          <FeedList
            items={recipeFeed.items}
            status={recipeFeed.status}
            hasMore={recipeFeed.hasMore}
            loadingMore={recipeFeed.loadingMore}
            loadMore={recipeFeed.loadMore}
            view="grid"
            gridAspect={COVER_ASPECT}
            empty="לא נמצאו מתכונים תואמים."
          />
        ) : people === null ? (
          <p className="py-8 text-center text-sm text-stone-500 animate-pulse">מחפש…</p>
        ) : people.length === 0 ? (
          <p className="py-16 text-center text-sm text-stone-500">לא נמצאו משתמשים תואמים.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {people.map((p) => (
              <PersonRow key={p.id} person={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
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
      className={`min-h-11 px-3 pb-2.5 text-sm font-medium ${
        active ? 'border-b-2 border-brand-600 text-brand-600' : 'text-stone-500'
      }`}
    >
      {children}
    </button>
  );
}
