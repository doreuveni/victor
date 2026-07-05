export interface IngredientSection {
  name: string;
  items: string[];
}

export interface InstructionStep {
  text: string;
  photo_url: string | null;
}

export interface DraftData {
  title: string;
  caption: string;
  category_id: string | null;
  prep_min: number | null;
  cook_min: number | null;
  servings: number | null;
  is_public: boolean;
  cover_url: string | null;
  photos: string[]; // extra gallery photos (cover is separate)
  sections: IngredientSection[];
  steps: InstructionStep[];
}

export function emptyDraft(): DraftData {
  return {
    title: '',
    caption: '',
    category_id: null,
    prep_min: null,
    cook_min: null,
    servings: null,
    is_public: true,
    cover_url: null,
    photos: [],
    sections: [{ name: '', items: [''] }],
    steps: [{ text: '', photo_url: null }],
  };
}

export const STEP_LABELS = ['תמונות', 'פרטים', 'מרכיבים', 'הוראות', 'תצוגה'] as const;
