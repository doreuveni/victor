import { Link } from 'react-router-dom';
import SmartImage from '@/components/SmartImage';
import { HeartIcon } from '@/components/icons';
import SaveButton from '@/features/collections/SaveButton';
import type { FeedCard } from './types';

// A uniform grid tile — fixed aspect ratio (portrait on Home, square on
// Profile/Board), always object-cover. Deliberately not a Pinterest-style
// masonry: mixed landscape/portrait covers made the grid feel inconsistent,
// so every tile is cropped to the same shape regardless of the source photo.
export default function RecipeGridCard({ card, aspect }: { card: FeedCard; aspect: number }) {
  return (
    <Link
      to={`/r/${card.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative" style={{ aspectRatio: aspect }}>
        <SmartImage src={card.cover_url} alt="" className="h-full w-full object-cover" fallbackClassName="h-full w-full" />
        <div className="absolute end-1.5 top-1.5">
          <SaveButton recipeId={card.id} variant="overlay" />
        </div>
        <span className="absolute start-1.5 bottom-1.5 flex items-center gap-1 rounded-full bg-stone-900/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
          <HeartIcon size={12} /> {card.like_count}
        </span>
      </div>
      <div className="p-2">
        <h3 className="line-clamp-1 text-xs font-bold leading-snug text-stone-900">{card.title}</h3>
      </div>
    </Link>
  );
}
