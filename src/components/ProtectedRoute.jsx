import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If not authenticated and not loading, redirect to login
    if (!isLoadingAuth && !isAuthenticated && authChecked) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isLoadingAuth, authChecked, navigate]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  return <Outlet />;
}
