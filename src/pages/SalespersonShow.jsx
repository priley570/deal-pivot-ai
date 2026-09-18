import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TrendingDown, TrendingUp, Target, DollarSign, AlertTriangle, CheckCircle, Loader2, BarChart2, MapPin, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SalespersonShow() {
  const location = useLocation();
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [gamePlans, setGamePlans] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  // Vehicle fields
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [dealerPrice, setDealerPrice] = useState('');

  // Results
  const [loading, setLoading] = useState(false);
  const [marketData, setMarketData] = useState(null);
  const [listings, setListings] = useState([]);
  const [marketSummary, setMarketSummary] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    // Load sessions and game plans in parallel
    Promise.all([
      supabase.from('negotiation_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('game_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]).then(([{ data: s }, { data: g }]) => {
      if (s) setSessions(s);
      if (g) setGamePlans(g);

      // Pre-select session passed from SessionDetail
      const passedSession = location.state?.session;
      if (passedSession) {
        populateFromSession(passedSession);
        setSelectedItem({ type: 'session', id: passedSession.id });
        // If it already has market data, show it immediately
        if (passedSession.market_avg_price) {
          setMarketData({
            avg_price: passedSession.market_avg_price,
            min_price: passedSession.market_low_price,
            max_price: passedSession.market_high_price,
          });
        }
      }
    });
  }, [user]);

  const populateFromSession = (s) => {
    setYear(s.vehicle_year?.toString() || '');
    setMake(s.vehicle_make || '');
    setModel(s.vehicle_model || '');
    setZipCode(s.zip_code || '');
    setDealerPrice(s.dealer_asking_price?.toString() || '');
    setMarketData(null);
    setListings([]);
    setMarketSummary('');
    setError('');
  };

  const populateFromPlan = (p) => {
    setYear('');
    setMake(p.preferred_makes?.[0] || '');
    setModel(p.preferred_models?.[0] || '');
    setZipCode('');
    setDealerPrice(p.budget_max?.toString() || '');
    setMarketData(null);
    setListings([]);
    setMarketSummary('');
    setError('');
  };

  const handleDropdownChange = (value) => {
    if (value.startsWith('session:')) {
      const id = value.replace('session:', '');
      const session = sessions.find(s => s.id === id);
      if (session) {
        setSelectedItem({ type: 'session', id });
        populateFromSession(session);
        if (session.market_avg_price) {
          setMarketData({ avg_price: session.market_avg_price, min_price: session.market_low_price, max_price: session.market_high_price });
        }
      }
    } else if (value.startsWith('plan:')) {
      const id = value.replace('plan:', '');
      const plan = gamePlans.find(p => p.id === id);
      if (plan) {
        setSelectedItem({ type: 'plan', id });
        populateFromPlan(plan);
      }
    }
  };

  const currentDropdownValue = selectedItem ? `${selectedItem.type}:${selectedItem.id}` : '';

  const getPricingAnalysis = async () => {
    if (!make.trim() || !model.trim() || !zipCode.trim()) return;
    setLoading(true);
    setError('');
    setMarketData(null);
    setListings([]);
    setMarketSummary('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('make-model-search', {
        body: {
          year: year ? parseInt(year) : undefined,
          make: make.trim(),
          model: model.trim(),
          zip_code: zipCode.trim(),
          radius: 100,
          dealer_asking_price: dealerPrice ? parseFloat(dealerPrice) : undefined,
        }
      });

      if (fnError || data?.error) {
        setError(fnError?.message || data?.error || 'Failed to fetch pricing data.');
      } else {
        setMarketData(data.stats);
        setListings(data.similar_listings || []);
        setMarketSummary(data.market_summary || '');
      }
    } catch (err) {
      setError('Failed to fetch pricing data. Please try again.');
      console.error('Pricing fetch error:', err);
    }

    setLoading(false);
  };

  const canFetch = make.trim() && model.trim() && zipCode.trim();
  const diff = dealerPrice && marketData?.avg_price ? parseFloat(dealerPrice) - marketData.avg_price : null;
  const priceStatus = diff === null ? null : diff > 2000 ? 'overpaying' : diff > 0 ? 'slightly-high' : 'good-deal';

  const statusConfig = {
    'overpaying': { label: 'Above Market', color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
    'slightly-high': { label: 'Slightly High', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
    'good-deal': { label: 'Good Price', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  };

  return (
    <div className="min-h-screen bg-white px-4 pt-6 pb-10">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Vehicle Market Report</h1>
        <p className="text-xs text-slate-500 mt-0.5">Live pricing intelligence</p>
      </div>

      {/* Dropdown: Sessions + Game Plans */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Load from Session or Game Plan</p>
        <Select value={currentDropdownValue} onValueChange={handleDropdownChange}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Select a vehicle or game plan..." />
          </SelectTrigger>
          <SelectContent>
            {sessions.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Sessions</div>
                {sessions.map(s => (
                  <SelectItem key={s.id} value={`session:${s.id}`}>
                    {s.title || `${s.vehicle_year || ''} ${s.vehicle_make || ''} ${s.vehicle_model || ''}`.trim() || 'Unnamed Session'}
                    {s.market_avg_price ? ' ✓' : ''}
                  </SelectItem>
                ))}
              </>
            )}
            {gamePlans.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Game Plans</div>
                {gamePlans.map(p => (
                  <SelectItem key={p.id} value={`plan:${p.id}`}>
                    {p.preferred_makes?.join(', ') || 'Any Make'} {p.preferred_models?.join(', ') || ''}
                    {p.budget_max ? ` · up to $${Number(p.budget_max).toLocaleString()}` : ''}
                  </SelectItem>
                ))}
              </>
            )}
            {sessions.length === 0 && gamePlans.length === 0 && (
              <div className="px-3 py-4 text-sm text-slate-400 text-center">No sessions or game plans yet</div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Vehicle Input Form */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Vehicle Details</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Year</label>
            <Input value={year} onChange={e => setYear(e.target.value)} placeholder="2024" className="mt-1 rounded-xl text-sm h-9" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Make *</label>
            <Input value={make} onChange={e => setMake(e.target.value)} placeholder="Toyota" className="mt-1 rounded-xl text-sm h-9" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Model *</label>
            <Input value={model} onChange={e => setModel(e.target.value)} placeholder="Camry" className="mt-1 rounded-xl text-sm h-9" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Zip Code *</label>
            <Input value={zipCode} onChange={e => setZipCode(e.target.value)} placeholder="80202" className="mt-1 rounded-xl text-sm h-9" />
          </div>
        </div>
        <div className="mb-3">
          <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Dealer's Asking Price (optional)</label>
          <Input value={dealerPrice} onChange={e => setDealerPrice(e.target.value)} placeholder="32500" type="number" className="mt-1 rounded-xl text-sm h-9" />
        </div>
        <Button onClick={getPricingAnalysis} disabled={!canFetch || loading} className="w-full rounded-xl gap-2">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching live prices...</>
            : <><BarChart2 className="w-4 h-4" /> Get Pricing Analysis</>
          }
        </Button>
        {!canFetch && (
          <p className="text-[10px] text-slate-400 text-center mt-2">Make, Model, and Zip Code are required</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {marketData && !loading && (
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Vehicle</p>
            <p className="text-2xl font-bold text-slate-900">{year && `${year} `}{make} {model}</p>
            {marketSummary && <p className="text-xs text-slate-500 mt-1">{marketSummary}</p>}
          </div>

          {marketData.avg_price ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Market Low', value: marketData.min_price, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
                  { label: 'Average Sale', value: marketData.avg_price, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-100' },
                  { label: 'Market High', value: marketData.max_price, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={cn('rounded-2xl p-3 border text-center', bg)}>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                    <p className={cn('text-base font-bold', color)}>${value?.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="bg-blue-600 rounded-2xl p-5 text-center shadow-lg shadow-blue-200">
                <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-1">Average Market Price</p>
                <p className="text-4xl font-bold text-white">${marketData.avg_price?.toLocaleString()}</p>
                <p className="text-xs text-blue-200 mt-1.5">Based on {listings.length} active listings within 100 miles</p>
              </div>

              {dealerPrice && priceStatus && (
                <div className={cn('rounded-2xl p-4 border', statusConfig[priceStatus].bg)}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-slate-700">Dealer's Asking Price</p>
                    <p className="text-xl font-bold text-slate-900">${parseFloat(dealerPrice).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {priceStatus === 'good-deal'
                      ? <CheckCircle className={cn('w-4 h-4 shrink-0', statusConfig[priceStatus].color)} />
                      : <AlertTriangle className={cn('w-4 h-4 shrink-0', statusConfig[priceStatus].color)} />
                    }
                    <p className={cn('text-sm font-medium', statusConfig[priceStatus].color)}>
                      {statusConfig[priceStatus].label}
                      {diff > 0 && ` · $${Math.round(diff).toLocaleString()} above market`}
                      {diff <= 0 && ` · $${Math.round(Math.abs(diff)).toLocaleString()} below market`}
                    </p>
                  </div>
                </div>
              )}

              {listings.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Similar Vehicles Nearby ({listings.length})
                  </p>
                  <div className="space-y-2">
                    {listings.slice(0, 6).map((listing, i) => (
                      <div key={listing.id || i} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-slate-800">
                              {listing.year} {listing.make} {listing.model}
                              {listing.trim && <span className="text-slate-500 font-normal"> {listing.trim}</span>}
                            </p>
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" />
                              {listing.dealer?.city}, {listing.dealer?.state}
                            </p>
                            {listing.days_on_market && (
                              <p className="text-xs text-slate-400 mt-0.5">{listing.days_on_market} days on lot</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600 text-base">${listing.price?.toLocaleString()}</p>
                            <p className="text-xs text-slate-400">{listing.miles?.toLocaleString()} mi</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" onClick={getPricingAnalysis} disabled={loading} className="w-full rounded-xl gap-2 text-sm">
                <RefreshCw className="w-4 h-4" /> Refresh Pricing
              </Button>
            </>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400">No listings found in this area</p>
              <p className="text-xs text-slate-400 mt-1">Try a different zip code or expand your search</p>
            </div>
          )}

          <p className="text-center text-[10px] text-slate-300 pb-2">Powered by MarketCheck live inventory data</p>
        </div>
      )}

      {!selectedItem && !marketData && !loading && (
        <div className="text-center py-16 text-slate-400">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a session or game plan above, or enter a vehicle manually</p>
        </div>
      )}
    </div>
  );
}
