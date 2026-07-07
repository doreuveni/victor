import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthProvider';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Onboarding from '@/pages/Onboarding';
import Home from '@/pages/Home';
import Following from '@/pages/Following';
import Search from '@/pages/Search';
import CreateRecipe from '@/features/create/CreateRecipe';
import NewRecipeChoice from '@/features/create/NewRecipeChoice';
import RecipeDetail from '@/features/recipe/RecipeDetail';
import Profile from '@/pages/Profile';
import EditProfile from '@/pages/EditProfile';
import Board from '@/pages/Board';
import Admin from '@/pages/Admin';
import { LogoMark, BanIcon } from '@/components/icons';
import InAppBrowserBanner from '@/components/InAppBrowserBanner';

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="animate-pulse text-brand-500">
        <LogoMark size={40} />
      </div>
    </div>
  );
}

function Banned() {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-danger-500">
        <BanIcon size={40} />
      </p>
      <h1 className="mt-3 text-lg font-bold">החשבון הושעה</h1>
      <p className="mt-1 text-sm text-stone-500">אם לדעתך זו טעות, צור קשר עם הצוות.</p>
      <button onClick={signOut} className="mt-5 text-sm font-medium text-brand-600">
        התנתק
      </button>
    </div>
  );
}

// /me redirects to the signed-in user's own /u/:username.
function MyProfile() {
  const { profile } = useAuth();
  if (!profile?.username) return null;
  return <Navigate to={`/u/${profile.username}`} replace />;
}

// /admin is only reachable by admins.
function AdminRoute() {
  const { profile } = useAuth();
  if (!profile?.is_admin) return <Navigate to="/" replace />;
  return <Admin />;
}

export default function App() {
  const { session, profile, loading } = useAuth();

  // Shown above every branch below — an in-app-browser session that never
  // persists is the same problem whether you're logged in or still on Login.
  const banner = <InAppBrowserBanner />;

  // 1. Still resolving session/profile.
  if (loading) return (
    <>
      {banner}
      <Splash />
    </>
  );

  // 2. Not signed in.
  if (!session) return (
    <>
      {banner}
      <Login />
    </>
  );

  // 3. Signed in but no username yet -> mandatory one-time onboarding.
  if (!profile?.username) return (
    <>
      {banner}
      <Onboarding />
    </>
  );

  // 4. Banned accounts get a lockout screen instead of the app.
  if (profile.is_banned) return (
    <>
      {banner}
      <Banned />
    </>
  );

  // 5. Full app.
  return (
    <BrowserRouter>
      {banner}
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/following" element={<Following />} />
          <Route path="/search" element={<Search />} />
          <Route path="/create" element={<NewRecipeChoice />} />
          <Route path="/create/new" element={<CreateRecipe />} />
          <Route path="/r/:id/edit" element={<CreateRecipe />} />
          <Route path="/r/:id" element={<RecipeDetail />} />
          <Route path="/u/:username" element={<Profile />} />
          <Route path="/me/edit" element={<EditProfile />} />
          <Route path="/b/:id" element={<Board />} />
          <Route path="/me" element={<MyProfile />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
