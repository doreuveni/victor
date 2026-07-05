// Hebrew relative time ("לפני 5 דקות"), used by comments + notifications.
export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'עכשיו';
  const min = Math.floor(sec / 60);
  if (min < 60) return `לפני ${min} דק'`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `לפני ${hr} שע'`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `לפני ${day} ימים`;
  const week = Math.floor(day / 7);
  if (week < 5) return `לפני ${week} שבועות`;
  const month = Math.floor(day / 30);
  if (month < 12) return `לפני ${month} חודשים`;
  return `לפני ${Math.floor(day / 365)} שנים`;
}
