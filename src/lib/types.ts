// Hand-written domain types mirroring supabase/migrations, used by app code.
// Once the project is linked, regenerate the full typed Database with:
//   supabase gen types typescript --linked > src/lib/types.ts
// and re-enable the typed client in src/lib/supabase.ts.

export type RecipeStatus = 'draft' | 'published';
export type NotificationType =
  | 'follow'
  | 'like'
  | 'comment'
  | 'collection_add'
  | 'new_post';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_admin: boolean;
  is_banned: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name_he: string;
  position: number;
}

export interface Recipe {
  id: string;
  author_id: string;
  title: string;
  caption: string | null;
  category_id: string | null;
  prep_min: number | null;
  cook_min: number | null;
  servings: number | null;
  cover_url: string | null;
  status: RecipeStatus;
  is_public: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
