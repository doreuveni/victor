export type ReportTargetType = 'recipe' | 'comment' | 'profile';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

// Row shape returned by the admin_reports() RPC.
export interface AdminReport {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string | null;
  status: ReportStatus;
  created_at: string;
  reporter_username: string | null;
  recipe_id: string | null;
  recipe_title: string | null;
  recipe_author_username: string | null;
  recipe_is_public: boolean | null;
  comment_body: string | null;
  comment_recipe_id: string | null;
  comment_author_username: string | null;
  profile_username: string | null;
  profile_is_banned: boolean | null;
}
