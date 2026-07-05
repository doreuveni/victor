import { useState } from 'react';
import { ImageOffIcon } from './icons';

interface Props {
  src: string | null;
  alt: string;
  className?: string;
  /** Extra classes for the fallback placeholder (e.g. to match the image's aspect ratio). */
  fallbackClassName?: string;
}

// <img> with a graceful fallback: missing url or a failed load both render the
// same placeholder instead of a blank broken-image glyph.
export default function SmartImage({ src, alt, className, fallbackClassName }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-stone-100 text-stone-300 ${fallbackClassName ?? className ?? ''}`}>
        <ImageOffIcon size={28} />
      </div>
    );
  }

  return <img src={src} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} />;
}
