export interface Comment {
  id: string;
  recipe_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body: string;
  like_count: number;
  created_at: string;
  author: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}
