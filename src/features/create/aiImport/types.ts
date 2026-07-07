export interface AiImportSection {
  name: string;
  items: string[];
}

export interface AiImportStep {
  text: string;
}

// Raw shape returned by the ai-recipe-import edge function — matches the
// json_schema passed to Claude, a subset of DraftData (no photo fields: the
// source images are never saved, the user adds real photos separately).
export interface AiImportResponse {
  found: boolean;
  title: string;
  caption: string;
  category_slug: string | null;
  prep_min: number | null;
  cook_min: number | null;
  servings: number | null;
  sections: AiImportSection[];
  steps: AiImportStep[];
}

export type AiImportError = 'daily_limit_reached' | 'not_found' | 'failed';
