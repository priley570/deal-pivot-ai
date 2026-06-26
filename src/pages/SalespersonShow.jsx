import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingDown, TrendingUp, Target, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SalespersonShow() {
  const location = useLocation();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(location.state?.session || null);

  useEffect(() => {
    base44.entities.NegotiationSession.list('-created_date', 20).then(setSessions);
  }, []);

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
              <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!s && (
        <div className="text-center py-16 text-slate-400">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a vehicle to view market data</p>
        </div>
      )}

      {s && (
        <div className="space-y-4">
          {/* Vehicle Identity */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Vehicle</p>
            <p className="text-2xl font-bold text-slate-900">
              {s.vehicle_year} {s.vehicle_make} {s.vehicle_model}
            </p>
            {s.vehicle_trim && <p className="text-sm text-slate-500 mt-0.5">{s.vehicle_trim}</p>}
            {s.vin && <p className="text-xs text-slate-400 font-mono mt-1">VIN: {s.vin}</p>}
          </div>

          {/* Market Pricing Grid */}
          {hasMarketData ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Market Low', value: s.market_low_price, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
                  { label: 'Average Sale', value: s.market_avg_price, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-100' },
                  { label: 'Market High', value: s.market_high_price, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={cn('rounded-2xl p-3 border text-center', bg)}>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                    <p className={cn('text-base font-bold', color)}>${value?.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Target Price — Big Feature */}
              <div className="bg-blue-600 rounded-2xl p-5 text-center shadow-lg shadow-blue-200">
                <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-1">Fair Market Target Price</p>
                <p className="text-4xl font-display font-bold text-white">${s.fair_target_price?.toLocaleString()}</p>
                <p className="text-xs text-blue-200 mt-1.5">Based on current regional transaction data</p>
              </div>

              {/* Dealer vs Market */}
              {s.dealer_asking_price && (
                <div className={cn('rounded-2xl p-4 border', diff > 1000 ? 'bg-red-50 border-red-100' : diff > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100')}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-slate-700">Dealer's Asking Price</p>
                    <p className="text-xl font-bold text-slate-900">${s.dealer_asking_price?.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {diff > 0 ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <p className="text-sm text-amber-800 font-medium">
                          ${diff.toLocaleString()} above fair market target
                        </p>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <p className="text-sm text-emerald-800 font-medium">
                          Priced ${Math.abs(diff).toLocaleString()} below fair market
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400">Market data not yet fetched</p>
              <p className="text-xs text-slate-400 mt-1">Open the session and tap "Get Prices"</p>
            </div>
          )}

          {/* Financing Snapshot */}
          {(s.dealer_apr || s.dealer_loan_term) && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Financing Offered</p>
              <div className="grid grid-cols-3 gap-3">
                {s.dealer_apr && (
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 mb-0.5">APR</p>
                    <p className="text-lg font-bold text-slate-800">{s.dealer_apr}%</p>
                  </div>
                )}
                {s.dealer_loan_term && (
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 mb-0.5">Term</p>
                    <p className="text-lg font-bold text-slate-800">{s.dealer_loan_term}mo</p>
                  </div>
                )}
                {s.dealer_monthly_payment && (
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 mb-0.5">Monthly</p>
                    <p className="text-lg font-bold text-slate-800">${s.dealer_monthly_payment}</p>
                  </div>
                )}
              </div>
              {s.dealer_apr > 5 && (
                <div className="mt-3 flex items-start gap-2 bg-blue-50 rounded-xl p-2.5">
                  <DollarSign className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 font-medium">
                    Credit union pre-approval rates typically run 2–3% lower. Ask about your pre-approved rate.
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-[10px] text-slate-300 pb-2">Pricing data is AI-estimated for reference purposes</p>
        </div>
      )}
    </div>
  );
}