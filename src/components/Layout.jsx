import { Link, useLocation, Outlet } from 'react-router-dom';
import { Home, Target, BarChart2, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/game-plan', icon: Target, label: 'Game Plan' },
  { path: '/salesperson-show', icon: BarChart2, label: 'Show' },
  { path: '/history', icon: Clock, label: 'History' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-border z-50">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('w-5 h-5', active && 'stroke-[2.5px]')} />
                <span className={cn('text-[10px] font-medium', active && 'font-semibold')}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}