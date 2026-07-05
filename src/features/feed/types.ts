// Row shape returned by the feed_explore / feed_following RPCs (public.feed_card).
export interface FeedCard {
  id: string;
  title: string;
  cover_url: string | null;
  caption: string | null;
  created_at: string;
  author_id: string;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  like_count: number;
  comment_count: number;
  category_name: string | null;
}

export const PAGE_SIZE = 12;
