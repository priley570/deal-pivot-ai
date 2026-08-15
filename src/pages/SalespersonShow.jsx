import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingDown, TrendingUp, Target, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SalespersonShow() {
  const location = useLocation();
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(location.state?.session || null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('negotiation_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setSessions(data);
    };
    load();
  }, [user]);

  const s = selectedSession;

  const hasMarketData = s?.market_avg_price;
  const diff = s?.dealer_asking_price && s?.fair_target_price
    ? s.dealer_asking_price - s.fair_target_price : null;

  return (
    <div className="min-h-screen bg-white px-4 pt-6 pb-6">
      {/* Minimal header — no AI branding */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">Vehicle Market Report</h1>
        <p className="text-xs text-slate-500 mt-0.5">Live pricing intelligence</p>
      </div>

      <div className="mb-5">
        <Select
          value={selectedSession?.id || ''}
          onValueChange={id => setSelectedSession(sessions.find(s => s.id === id) || null)}
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Select a vehicle..." />
          </SelectTrigger>
          <SelectContent>
            {sessions.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.vehicle_year} {s.vehicle_make} {s.vehicle_model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {s && (
        <>
          {/* Vehicle */}
          <div className="mb-5 p-4 rounded-2xl bg-slate-50">
            <h2 className="text-lg font-bold text-slate-900">{s.vehicle_year} {s.vehicle_make} {s.vehicle_model}</h2>
            {s.vehicle_trim && <p className="text-sm text-slate-500">{s.vehicle_trim}</p>}
            {s.dealer_name && <p className="text-sm text-slate-600 mt-1">{s.dealer_name}</p>}
          </div>

          {/* Market Data */}
          {hasMarketData ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50">
                  <p className="text-xs text-slate-500 uppercase">Market Low</p>
                  <p className="text-xl font-bold text-slate-900">${s.market_low_price?.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50">
                  <p className="text-xs text-slate-500 uppercase">Market Avg</p>
                  <p className="text-xl font-bold text-slate-900">${s.market_avg_price?.toLocaleString()}</p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                <p className="text-xs text-emerald-600 uppercase font-semibold">Your Target Price</p>
                <p className="text-2xl font-bold text-emerald-700">${s.fair_target_price?.toLocaleString()}</p>
              </div>

              {diff !== null && (
                <div className={cn(
                  "p-4 rounded-2xl",
                  diff > 2000 ? "bg-red-50 border border-red-100" :
                  diff > 0 ? "bg-amber-50 border border-amber-100" :
                  "bg-emerald-50 border border-emerald-100"
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Dealer Asking</p>
                      <p className="text-xl font-bold text-slate-900">${s.dealer_asking_price?.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 uppercase">{diff > 0 ? 'Above' : 'Below'} Target</p>
                      <p className={cn(
                        "text-xl font-bold",
                        diff > 2000 ? "text-red-600" :
                        diff > 0 ? "text-amber-600" :
                        "text-emerald-600"
                      )}>
                        {diff > 0 ? '+' : ''}${diff.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Negotiation Tips */}
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                <p className="text-xs font-semibold text-blue-700 uppercase mb-2">Negotiation Tips</p>
                {diff > 2000 && (
                  <p className="text-sm text-slate-700">
                    The asking price is significantly above market value. Use our market data to negotiate down to <strong>${s.fair_target_price?.toLocaleString()}</strong>. Start with: "I've seen similar vehicles advertised at $X, what's your best out-the-door price?"
                  </p>
                )}
                {diff > 0 && diff <= 2000 && (
                  <p className="text-sm text-slate-700">
                    The price is slightly high. Offer <strong>${s.fair_target_price?.toLocaleString()}</strong> and be prepared to meet in the middle around <strong>${Math.round((s.dealer_asking_price + s.fair_target_price) / 2).toLocaleString()}</strong>.
                  </p>
                )}
                {diff <= 0 && (
                  <p className="text-sm text-slate-700">
                    Great price! The dealer's asking is at or below market value. Focus on negotiating add-ons (paint protection, VIN etching, extended warranties) rather than the vehicle price.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-slate-50">
              <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No market data yet</p>
              <p className="text-xs text-slate-400 mt-1">Open the session to fetch pricing</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
