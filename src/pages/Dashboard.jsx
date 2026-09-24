import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Car, TrendingDown, Clock, ChevronRight, Target, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Build a human-readable title from session data.
 * Priority: stored vehicle fields > stored title.
 * Existing sessions that have year/make/model will show the
 * real vehicle name even if their stored title is "New Negotiation".
 */
function getSessionTitle(session) {
  const parts = [session.vehicle_year, session.vehicle_make, session.vehicle_model].filter(Boolean);
  if (parts.length > 0) {
    const vehicle = parts.join(' ');
    return session.dealer_name ? `${vehicle} @ ${session.dealer_name}` : vehicle;
  }
  // Fall back to stored title, but replace bare "New Negotiation" with dealer if available
  if (session.title === 'New Negotiation' && session.dealer_name) {
    return `Negotiation @ ${session.dealer_name}`;
  }
  return session.title || 'New Negotiation';
}

/**
 * Build a short subtitle line (trim + VIN hint).
 */
function getSessionSubtitle(session) {
  const bits = [];
  if (session.vehicle_trim) bits.push(session.vehicle_trim);
  if (session.vin) bits.push(`VIN …${session.vin.slice(-6)}`);
  return bits.join(' · ') || null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null); // session object pending delete
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('negotiation_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error) setSessions(data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleNewSession = () => navigate('/session/new');

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from('negotiation_sessions')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('user_id', user.id);

    if (!error) {
      setSessions(prev => prev.filter(s => s.id !== deleteTarget.id));
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const recentSessions = sessions.slice(0, 3);
  const totalSaved = sessions.reduce((acc, s) => acc + (s.amount_saved || 0), 0);

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center overflow-hidden">
            <img src="/logo64.png" alt="Deal Pivot AI" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">DealPivot AI</p>
            <h1 className="text-xl font-display font-bold text-foreground leading-tight">
              {loading ? 'Welcome back' : `Hi, ${user?.full_name?.split(' ')[0] || 'there'}`}
            </h1>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Sessions</p>
            <p className="text-2xl font-bold text-foreground">{sessions.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Est. Saved</p>
            <p className="text-2xl font-bold text-primary">
              {totalSaved > 0 ? `$${totalSaved.toLocaleString()}` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CTAs */}
      <Link to="/game-plan" className="block mb-3">
        <button className="w-full h-14 text-base font-semibold rounded-2xl border-2 border-primary/30 bg-blue-50 hover:bg-blue-100 text-primary transition-colors flex items-center justify-center gap-2">
          <Target className="w-5 h-5" />
          Create a Game Plan
        </button>
      </Link>
      <Button
        onClick={handleNewSession}
        className="w-full h-14 text-base font-semibold rounded-2xl shadow-md shadow-primary/20 mb-6 gap-2"
      >
        <Plus className="w-5 h-5" />
        Start New Negotiation
      </Button>

      {/* Quick Tips */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Pro Tip</p>
        <p className="text-sm text-foreground leading-relaxed">
          At the dealership? Scan the window sticker first, then use voice to ask the AI about any offer the salesperson makes.
        </p>
      </div>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Recent Sessions</h2>
            <Link to="/history" className="text-xs text-primary font-medium">View all</Link>
          </div>

          <div className="space-y-2">
            {recentSessions.map(session => {
              const displayTitle = getSessionTitle(session);
              const subtitle = getSessionSubtitle(session);
              return (
                <Card
                  key={session.id}
                  className="border-border shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-0">
                    <div className="flex items-stretch">
                      {/* Clickable main area — navigates to session */}
                      <button
                        onClick={() => navigate(`/session/${session.id}`)}
                        className="flex items-center gap-3 flex-1 min-w-0 p-4 text-left"
                      >
                        <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                          <Car className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground leading-tight truncate">
                            {displayTitle}
                          </p>
                          {subtitle && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {session.amount_saved > 0 && (
                            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <TrendingDown className="w-3 h-3" />
                              <span className="text-xs font-semibold">${session.amount_saved.toLocaleString()}</span>
                            </div>
                          )}
                          <Badge
                            variant={session.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs capitalize"
                          >
                            {session.status}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </button>

                      {/* Delete button — separate from the nav area */}
                      <button
                        onClick={() => setDeleteTarget(session)}
                        className="flex items-center justify-center w-12 border-l border-border text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors rounded-r-xl"
                        aria-label="Delete negotiation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="text-center py-10">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">No sessions yet. Start one when you're at the dealership.</p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this negotiation?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  <span className="font-semibold text-foreground">{getSessionTitle(deleteTarget)}</span>
                  {' '}and all of its chat history will be permanently deleted. This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
