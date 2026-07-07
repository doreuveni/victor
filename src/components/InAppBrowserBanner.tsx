import { useEffect, useState } from 'react';
import { isInAppBrowser } from '@/lib/inAppBrowser';
import { CopyIcon, XIcon } from './icons';

const DISMISS_KEY = 'inAppBannerDismissed';

// Instagram/Facebook/etc in-app browsers run an isolated WebView that drops
// the login session between opens. There's no way to force-open the system
// browser from here, so this just explains the situation and offers a
// one-tap copy of the current link to paste into Safari/Chrome.
export default function InAppBrowserBanner() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isInAppBrowser() && !sessionStorage.getItem(DISMISS_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!visible) return null;

  return (
    <div className="flex items-start gap-2 bg-accent-50 px-4 py-2.5 text-sm text-accent-700">
      <p className="flex-1">
        פתיחה בתוך אפליקציה חיצונית עלולה לנתק אותך בכל פעם. מומלץ לפתוח בדפדפן (ספארי/כרום):
        <button onClick={copyLink} className="ms-2 inline-flex items-center gap-1 font-semibold underline">
          <CopyIcon size={14} /> {copied ? 'הועתק!' : 'העתק קישור'}
        </button>
      </p>
      <button onClick={dismiss} aria-label="סגור" className="shrink-0 text-accent-500 hover:text-accent-700">
        <XIcon size={14} />
      </button>
    </div>
  );
}
