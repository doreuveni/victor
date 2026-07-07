import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { FolderIcon, BookmarkIcon, PlusIcon } from '@/components/icons';
import type { Collection } from './types';

// Public boards for a stranger; RLS on `collections` naturally restricts to
// is_public rows unless the caller is the owner (or admin). `isSelf` gates
// the "new collection" affordance — only the owner can create their own boards.
export default function BoardsGrid({ ownerId, isSelf = false }: { ownerId: string; isSelf?: boolean }) {
  const [boards, setBoards] = useState<Collection[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setBoards(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  function load() {
    return supabase
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
  }

  async function createBoard() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('collections')
      .insert({ owner_id: ownerId, name, is_public: true })
      .select('id, name, is_default, is_public, created_at')
      .single();
    if (!error && data) {
      setBoards((prev) => [...(prev ?? []), { ...(data as Omit<Collection, 'item_count'>), item_count: 0 }]);
      setNewName('');
      setShowForm(false);
    }
    setCreating(false);
  }

  if (boards === null) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-100" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {isSelf && (
        <div className="mb-3">
          {showForm ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createBoard()}
                placeholder="שם האוסף…"
                className="min-h-11 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              <button
                onClick={createBoard}
                disabled={!newName.trim() || creating}
                className="min-h-11 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
              >
                צור
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setNewName('');
                }}
                className="min-h-11 rounded-xl bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200"
              >
                ביטול
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 py-2.5 text-sm font-medium text-brand-600 hover:border-brand-300 hover:bg-brand-50/30"
            >
              <PlusIcon size={16} />
              אוסף חדש
            </button>
          )}
        </div>
      )}

      {boards.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-500">אין עדיין אוספים.</p>
      ) : (
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
      )}
    </div>
  );
}
