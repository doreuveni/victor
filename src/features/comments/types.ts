export interface Comment {
  id: string;
  recipe_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}
