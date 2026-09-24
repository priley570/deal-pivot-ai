import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Car, TrendingDown, ChevronRight, Clock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';

/** Mirrors the same helper in Dashboard.jsx */
function getSessionTitle(session) {
  const parts = [session.vehicle_year, session.vehicle_make, session.vehicle_model].filter(Boolean);
  if (parts.length > 0) {
    const vehicle = parts.join(' ');
    return session.dealer_name ? `${vehicle} @ ${session.dealer_name}` : vehicle;
  }
  if (session.title === 'New Negotiation' && session.dealer_name) {
    return `Negotiation @ ${session.dealer_name}`;
  }
  return session.title || 'New Negotiation';
}

export default function History() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('negotiation_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (!error) {
        setSessions(data || []);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const filtered = sessions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    // Search across display title AND all raw vehicle/dealer fields
    return (
      getSessionTitle(s).toLowerCase().includes(q) ||
      s.title?.toLowerCase().includes(q) ||
      s.dealer_name?.toLowerCase().includes(q) ||
      s.vehicle_year?.toLowerCase().includes(q) ||
      s.vehicle_make?.toLowerCase().includes(q) ||
      s.vehicle_model?.toLowerCase().includes(q) ||
      s.vehicle_trim?.toLowerCase().includes(q) ||
      s.vin?.toLowerCase().includes(q)
    );
  });

  const statusColors = {
    active: 'default',
    completed: 'secondary',
    abandoned: 'outline',
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="text-2xl font-display font-bold text-foreground mb-1">History</h1>
      <p className="text-sm text-muted-foreground mb-5">All your negotiation sessions</p>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sessions..."
          className="pl-9 rounded-xl"
        />
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-secondary rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-14">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-sm text-muted-foreground">{search ? 'No matching sessions.' : 'No sessions yet.'}</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(session => (
          <Link key={session.id} to={`/session/${session.id}`}>
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <Car className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{getSessionTitle(session)}</p>
                      {session.vehicle_trim && (
                        <p className="text-xs text-muted-foreground truncate">{session.vehicle_trim}{session.vin ? ` · VIN …${session.vin.slice(-6)}` : ''}</p>
                      )}
                      {!session.vehicle_trim && session.dealer_name && (
                        <p className="text-xs text-muted-foreground truncate">{session.dealer_name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant={statusColors[session.status] || 'secondary'} className="text-[10px] capitalize">
                          {session.status}
                        </Badge>
                        {session.market_avg_price && (
                          <span className="text-[10px] text-muted-foreground">
                            Mkt avg: <span className="font-semibold text-foreground">${session.market_avg_price?.toLocaleString()}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {session.amount_saved > 0 && (
                      <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <TrendingDown className="w-3 h-3" />
                        <span className="text-xs font-semibold">${session.amount_saved.toLocaleString()}</span>
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {session.created_at ? format(new Date(session.created_at), 'MMM d, yyyy') : ''}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
