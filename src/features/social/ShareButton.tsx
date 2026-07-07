import { useState } from 'react';
import { CopyIcon, LinkIcon, ShareIcon, WhatsAppIcon, XIcon } from '@/components/icons';

interface Props {
  title: string;
  path: string; // e.g. `/r/${recipeId}`
}

// Web Share API (navigator.share) already puts WhatsApp/Instagram/Messages/etc
// as targets in the OS share sheet on mobile — no need to hand-roll per-app
// deep links there. Desktop/unsupported browsers fall back to a small
// popover with an explicit WhatsApp link + copy-link.
export default function ShareButton({ title, path }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${path}`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled the share sheet — not an error
      }
      return;
    }
    setOpen(true);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <button onClick={share} className="flex min-h-11 items-center gap-1.5 text-sm hover:text-brand-600" aria-label="שתף">
        <ShareIcon size={20} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full z-30 mt-2 w-52 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-medium text-stone-500">שתף מתכון</span>
              <button onClick={() => setOpen(false)} aria-label="סגור" className="text-stone-400 hover:text-stone-600">
                <XIcon size={13} />
              </button>
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-stone-50"
            >
              <WhatsAppIcon size={18} /> שתף בוואטסאפ
            </a>
            <button onClick={copyLink} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-sm hover:bg-stone-50">
              {copied ? <CopyIcon size={18} /> : <LinkIcon size={18} />} {copied ? 'הועתק!' : 'העתק קישור'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
