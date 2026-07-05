interface Props {
  url: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  className?: string;
}

// Shared avatar: a real photo, or the first letter of the display name on a
// brand-tinted circle. Used everywhere a user is shown (feed, detail, profile,
// comments, notifications) so the fallback treatment stays consistent.
export default function Avatar({ url, name, size = 24, className }: Props) {
  const dim = { width: size, height: size };
  if (url) {
    return <img src={url} alt="" style={dim} className={`shrink-0 rounded-full object-cover ${className ?? ''}`} />;
  }
  return (
    <div
      style={dim}
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 ${className ?? ''}`}
    >
      <span style={{ fontSize: size * 0.42 }}>{name?.[0]?.toUpperCase() ?? '?'}</span>
    </div>
  );
}
