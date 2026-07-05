// Row shape returned by the search_profiles RPC.
export interface SearchProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  followers_count: number;
  is_following: boolean;
}
