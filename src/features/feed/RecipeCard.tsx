import { Link } from 'react-router-dom';
import Avatar from '@/components/Avatar';
import SmartImage from '@/components/SmartImage';
import { HeartIcon, CommentIcon } from '@/components/icons';
import type { FeedCard } from './types';

// A single feed card (list view). Whole card links to the recipe detail view.
export default function RecipeCard({ card }: { card: FeedCard }) {
  const author = card.author_display_name || card.author_username || 'משתמש';
  return (
    <Link
      to={`/r/${card.id}`}
      className="block overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm transition hover:shadow-md"
    >
      <SmartImage
        src={card.cover_url}
        alt=""
        className="aspect-[4/3] w-full object-cover"
        fallbackClassName="aspect-[4/3] w-full"
      />
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-bold leading-snug text-stone-900">{card.title}</h3>
          {card.category_name && (
            <span className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700">
              {card.category_name}
            </span>
          )}
        </div>
        {card.caption && <p className="mt-1 line-clamp-2 text-sm text-stone-500">{card.caption}</p>}
        <div className="mt-2.5 flex items-center gap-2 text-xs text-stone-500">
          <Avatar url={card.author_avatar_url} name={author} size={24} />
          <span className="truncate">{author}</span>
          <div className="flex-1" />
          <span className="flex items-center gap-1">
            <HeartIcon size={15} /> {card.like_count}
          </span>
          <span className="flex items-center gap-1">
            <CommentIcon size={15} /> {card.comment_count}
          </span>
        </div>
      </div>
    </Link>
  );
}
