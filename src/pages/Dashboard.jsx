import { useState, useEffect } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Car, TrendingDown, Clock, ChevronRight, Target } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const [u, s] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.NegotiationSession.list('-created_date', 5)
      ]);
      setUser(u);
      setSessions(s);
      setLoading(false);
    };
    load();
  }, []);

  const handleNewSession = () => navigate('/session/new');

  const recentSessions = sessions.slice(0, 3);
  const totalSaved = sessions.reduce((acc, s) => acc + (s.amount_saved || 0), 0);

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center overflow-hidden">
            <img src="https://media.base44.com/images/public/6a22fa41589c7b7f0c3fc365/7d82fc5d0_favicon_32.png" alt="DealPivot" className="w-7 h-7 object-contain" />
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
            {recentSessions.map(session => (
              <Link key={session.id} to={`/session/${session.id}`}>
                <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
                        <Car className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{session.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(session.created_date), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.amount_saved > 0 && (
                        <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <TrendingDown className="w-3 h-3" />
                          <span className="text-xs font-semibold">${session.amount_saved.toLocaleString()}</span>
                        </div>
                      )}
                      <Badge variant={session.status === 'active' ? 'default' : 'secondary'} className="text-xs capitalize">
                        {session.status}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="text-center py-10">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">No sessions yet. Start one when you're at the dealership.</p>
        </div>
      )}
    </div>
  );
}