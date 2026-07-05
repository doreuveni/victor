import type { DraftData } from './types';
import PhotoButton from '@/components/PhotoButton';
import { XIcon } from '@/components/icons';
import { COVER_ASPECT } from '@/lib/constants';

interface Props {
  data: DraftData;
  update: (patch: Partial<DraftData>) => void;
}

export default function StepPhotos({ data, update }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-stone-900">תמונת שער</h2>
        <p className="mb-2 text-sm text-stone-500">
          התמונה הראשית של המתכון — כך היא תיראה בכרטיסייה. אפשר למקם ולהתקרב לפני השמירה.
        </p>
        {data.cover_url ? (
          <div className="relative mx-auto max-w-[220px]">
            <img
              src={data.cover_url}
              alt="שער"
              className="w-full rounded-2xl object-cover"
              style={{ aspectRatio: COVER_ASPECT }}
            />
            <button
              type="button"
              onClick={() => update({ cover_url: null })}
              className="absolute end-2 top-2 flex h-9 items-center gap-1 rounded-full bg-black/60 px-3 text-xs font-medium text-white"
            >
              <XIcon size={13} /> הסר
            </button>
          </div>
        ) : (
          <PhotoButton label="הוסף תמונת שער" aspect={COVER_ASPECT} onUploaded={(url) => update({ cover_url: url })} />
        )}
      </div>

      <div>
        <h2 className="font-semibold text-stone-900">תמונות נוספות</h2>
        <p className="mb-2 text-sm text-stone-500">אופציונלי — גלריה של המנה.</p>
        <div className="grid grid-cols-3 gap-2">
          {data.photos.map((url, i) => (
            <div key={url} className="relative">
              <img src={url} alt="" className="aspect-square w-full rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => update({ photos: data.photos.filter((_, j) => j !== i) })}
                aria-label="הסר תמונה"
                className="absolute end-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <XIcon size={12} />
              </button>
            </div>
          ))}
          <div className="aspect-square">
            <PhotoButton onUploaded={(url) => update({ photos: [...data.photos, url] })} />
          </div>
        </div>
      </div>
    </div>
  );
}
