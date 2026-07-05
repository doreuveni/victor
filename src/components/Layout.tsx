import { useState, type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthProvider';
import { useNotifications } from '@/features/notifications/useNotifications';
import NotificationsPanel from '@/features/notifications/NotificationsPanel';
import { LogoMark, HomeIcon, UsersIcon, PlusIcon, UserIcon, BellIcon, ShieldIcon, SearchIcon } from './icons';

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { items, unread, loaded, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-white shadow-sm">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2 text-brand-600">
          <LogoMark size={26} />
          <span className="font-display ltr text-xl leading-none text-stone-900">Victor</span>
        </div>
        <div className="flex items-center gap-1">
          {profile?.is_admin && (
            <Link
              to="/admin"
              className="flex h-11 w-11 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
              aria-label="ניהול"
            >
              <ShieldIcon />
            </Link>
          )}
          <button
            onClick={() => {
              setOpen((o) => !o);
              if (!open) markAllRead();
            }}
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
            aria-label="התראות"
          >
            <BellIcon />
            {unread > 0 && (
              <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button
            onClick={signOut}
            className="max-w-24 truncate rounded-full px-2 py-1 text-sm text-stone-500 hover:text-stone-800"
          >
            {profile?.display_name || `@${profile?.username}`}
          </button>
        </div>
      </header>

      {open && <NotificationsPanel items={items} loaded={loaded} onClose={() => setOpen(false)} />}

      {/* Content */}
      <main className="flex-1 pb-28">{children}</main>

      {/* Bottom nav (mobile-first). Uses logical start/end so it mirrors in RTL. */}
      <nav className="pb-safe-nav fixed bottom-0 z-10 mx-auto flex w-full max-w-lg items-center justify-around border-t border-stone-100 bg-white/95 pt-2 backdrop-blur">
        <NavItem to="/" label="גלה" end>
          <HomeIcon />
        </NavItem>
        <NavItem to="/following" label="עוקב">
          <UsersIcon />
        </NavItem>
        <Link
          to="/create"
          aria-label="פרסם מתכון"
          className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600 active:scale-95"
        >
          <PlusIcon size={26} />
        </Link>
        <NavItem to="/search" label="חיפוש">
          <SearchIcon size={22} />
        </NavItem>
        <NavItem to="/me" label="פרופיל">
          <UserIcon />
        </NavItem>
      </nav>
    </div>
  );
}

function NavItem({
  to,
  label,
  end,
  children,
}: {
  to: string;
  label: string;
  end?: boolean;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-xs ${
          isActive ? 'text-brand-600' : 'text-stone-400'
        }`
      }
    >
      {children}
      {label}
    </NavLink>
  );
}
