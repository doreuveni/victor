import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { FolderIcon, BookmarkIcon } from '@/components/icons';
import type { Collection } from './types';

// Public boards for a stranger; RLS on `collections` naturally restricts to
// is_public rows unless the caller is the owner (or admin).
export default function BoardsGrid({ ownerId }: { ownerId: string }) {
  const [boards, setBoards] = useState<Collection[] | null>(null);

  useEffect(() => {
    setBoards(null);
    supabase
      .from('collections')
      .select('id, name, is_default, is_public, created_at, collection_items(count)')
      .eq('owner_id', ownerId)
      .order('is_default', { ascending: false })
      .order('created_at')
      .then(({ data }) => {
        type Row = Omit<Collection, 'item_count'> & { collection_items: { count: number }[] };
        const rows = ((data ?? []) as unknown as Row[]).map((r) => ({
          id: r.id,
          name: r.name,
          is_default: r.is_default,
          is_public: r.is_public,
          created_at: r.created_at,
          item_count: r.collection_items?.[0]?.count ?? 0,
        }));
        setBoards(rows);
      });
  }, [ownerId]);

  if (boards === null) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-100" />
        ))}
      </div>
    );
  }

  if (boards.length === 0) {
    return <p className="py-10 text-center text-sm text-stone-500">אין עדיין אוספים.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {boards.map((b) => (
        <Link
          key={b.id}
          to={`/b/${b.id}`}
          className="min-h-11 rounded-2xl border border-stone-100 p-4 text-accent-600 hover:border-brand-200 hover:bg-brand-50/30"
        >
          {b.is_default ? <BookmarkIcon size={22} filled /> : <FolderIcon size={22} />}
          <p className="mt-1.5 truncate font-semibold text-stone-900">{b.name}</p>
          <p className="text-xs text-stone-500">{b.item_count} מתכונים</p>
          {!b.is_public && <p className="mt-1 text-xs text-stone-500">פרטי</p>}
        </Link>
      ))}
    </div>
  );
}
