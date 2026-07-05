import { Link } from 'react-router-dom';
import { formatRelative } from '@/lib/time';
import { useScrollLock } from '@/lib/useScrollLock';
import Avatar from '@/components/Avatar';
import type { AppNotification } from './types';

interface Props {
  items: AppNotification[];
  loaded: boolean;
  onClose: () => void;
}

export default function NotificationsPanel({ items, loaded, onClose }: Props) {
  useScrollLock();

  return (
    <div className="fixed inset-0 z-20" onClick={onClose}>
      <div
        className="absolute inset-x-0 top-14 mx-auto max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-b-2xl border-t border-stone-100 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 className="font-bold">התראות</h2>
        </div>

        {!loaded ? (
          <p className="py-8 text-center text-sm text-stone-500 animate-pulse">טוען…</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-500">אין עדיין התראות.</p>
        ) : (
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <Row n={n} onClose={onClose} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ n, onClose }: { n: AppNotification; onClose: () => void }) {
  const actorName = n.actor?.display_name || n.actor?.username || 'משתמש';
  const to = n.type === 'follow' ? `/u/${n.actor?.username}` : n.recipe_id ? `/r/${n.recipe_id}` : '#';

  return (
    <Link
      to={to}
      onClick={onClose}
      className={`flex items-start gap-3 border-b border-stone-50 px-4 py-3 hover:bg-stone-50 ${
        n.is_read ? '' : 'bg-brand-50/40'
      }`}
    >
      <Avatar url={n.actor?.avatar_url} name={actorName} size={36} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-stone-800">
          <span className="font-semibold">{actorName}</span> {message(n)}
        </p>
        <p className="mt-0.5 text-xs text-stone-500">{formatRelative(n.created_at)}</p>
      </div>
      {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
    </Link>
  );
}

function message(n: AppNotification): string {
  const title = n.recipe?.title ?? 'מתכון';
  switch (n.type) {
    case 'follow':
      return 'התחיל לעקוב אחריך';
    case 'like':
      return `אהב את "${title}"`;
    case 'comment':
      return `הגיב על "${title}"`;
    case 'collection_add':
      return `שמר את "${title}" לאוסף`;
    case 'new_post':
      return `פרסם מתכון חדש: "${title}"`;
  }
}
