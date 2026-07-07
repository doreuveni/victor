// Detects the worst-offending in-app browsers (Instagram/Facebook/Line/TikTok/
// WeChat) — these run an isolated WebView that doesn't share the system
// browser's storage, so Supabase's persisted session silently doesn't survive
// between opens. WhatsApp is deliberately not matched here: on iOS it opens
// links in SFSafariViewController, which shares Safari's cookie jar and
// already persists sessions fine; there's no reliable UA marker for it anyway.
const IN_APP_UA_PATTERN = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok/i;

export function isInAppBrowser(): boolean {
  return IN_APP_UA_PATTERN.test(navigator.userAgent);
}
