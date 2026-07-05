// Row shape returned by the get_profile RPC (public.get_profile).
export interface ProfileHeader {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  followers_count: number;
  following_count: number;
  recipe_count: number;
  is_following: boolean;
  is_self: boolean;
}
