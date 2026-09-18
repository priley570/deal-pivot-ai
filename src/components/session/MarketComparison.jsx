import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingDown, TrendingUp, RefreshCw, Loader2, BarChart2, MapPin, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MarketComparison({ session, onUpdate, zipCode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState([]);
  const [fetchError, setFetchError] = useState(null);

  // Resolve zip: prop > session notes (game plan ZIP) > user profile
  const resolvedZip = zipCode
    || session?.zip_code
    || user?.zip_code
    || (session?.notes?.match(/ZIP:\s*(\d{5})/)?.[1])
    || null;

  const fetchMarket = async () => {
    if (!session.vehicle_make || !session.vehicle_model) return;
    if (!resolvedZip) {
      setFetchError('No ZIP code found. Add one to your profile under Settings.');
      return;
    }

    setLoading(true);
    setFetchError(null);

    try {
      const { data, error } = await supabase.functions.invoke('make-model-search', {
        body: {
          year: session.vehicle_year ? parseInt(session.vehicle_year) : undefined,
          make: session.vehicle_make,
          model: session.vehicle_model,
          zip_code: resolvedZip,
          radius: 100,
          dealer_asking_price: session.dealer_asking_price || undefined,
        }
      });

      if (error || data?.error) throw new Error(error?.message || data?.error);

      const stats = data.stats;
      setListings(data.similar_listings || []);

      // Save stats back to the session
      await supabase
        .from('negotiation_sessions')
        .update({
          market_low_price: stats.min_price,
          market_avg_price: stats.avg_price,
          market_high_price: stats.max_price,
          fair_target_price: stats.avg_price, // use avg as fair target
        })
        .eq('id', session.id);

      onUpdate({
        market_low_price: stats.min_price,
        market_avg_price: stats.avg_price,
        market_high_price: stats.max_price,
        fair_target_price: stats.avg_price,
      });
    } catch (err) {
      console.error('Market fetch error:', err);
      setFetchError(err.message || 'Failed to fetch market data');
    }

    setLoading(false);
  };

  const hasData = session.market_avg_price;
  const dealerPrice = session.dealer_asking_price;
  const avgPrice = session.market_avg_price;
  const diff = dealerPrice && avgPrice ? dealerPrice - avgPrice : null;
  const priceStatus = diff === null ? null : diff > 2000 ? 'overpaying' : diff > 0 ? 'slightly-high' : 'good-deal';

  const statusConfig = {
    'overpaying': { label: 'Above Market', color: 'text-destructive', bg: 'bg-red-50', Icon: TrendingUp },
    'slightly-high': { label: 'Slightly High', color: 'text-amber-600', bg: 'bg-amber-50', Icon: TrendingUp },
    'good-deal': { label: 'Good Price', color: 'text-emerald-600', bg: 'bg-emerald-50', Icon: TrendingDown },
  };
  const config = statusConfig[priceStatus];

  const canFetch = session.vehicle_make && session.vehicle_model;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="w-4 h-4" />
            Market Pricing
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchMarket}
            disabled={loading || !canFetch}
            className="h-7 px-2 text-xs gap-1"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {hasData ? 'Refresh' : 'Get Prices'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {fetchError && (
          <p className="text-xs text-destructive">{fetchError}</p>
        )}

        {!canFetch && !fetchError && (
          <p className="text-xs text-muted-foreground">Enter a vehicle make and model to fetch market pricing.</p>
        )}

        {canFetch && !hasData && !loading && !fetchError && (
          <p className="text-xs text-muted-foreground">
            Tap "Get Prices" to fetch live market data for your {session.vehicle_year || ''} {session.vehicle_make} {session.vehicle_model}.
            {resolvedZip ? ` Searching within 100 miles of ${resolvedZip}.` : ' Add a ZIP code to your profile to enable pricing.'}
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Fetching live market data...</p>
          </div>
        )}

        {hasData && !loading && (
          <>
            {/* Price Grid */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { label: 'Market Low', value: session.market_low_price, color: 'text-emerald-600' },
                { label: 'Market Avg', value: session.market_avg_price, color: 'text-foreground font-bold' },
                { label: 'Market High', value: session.market_high_price, color: 'text-amber-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-secondary rounded-xl p-2 text-center">
                  <p className="text-muted-foreground text-[10px]">{label}</p>
                  <p className={cn('font-semibold mt-0.5', color)}>${value?.toLocaleString()}</p>
                </div>
              ))}
            </div>

            {/* Fair Target */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Average Market Price</p>
                <p className="text-lg font-bold text-primary">${session.market_avg_price?.toLocaleString()}</p>
              </div>
              {dealerPrice && (
                <p className="text-xs text-muted-foreground">
                  Dealer: <span className="font-semibold text-foreground">${dealerPrice?.toLocaleString()}</span>
                </p>
              )}
            </div>

            {/* Price Status */}
            {priceStatus && config && (
              <div className={cn('flex items-center gap-2 rounded-xl p-2.5', config.bg)}>
                <config.Icon className={cn('w-4 h-4', config.color)} />
                <p className={cn('text-xs font-semibold', config.color)}>
                  {config.label}
                  {diff > 0 && ` · $${Math.round(diff).toLocaleString()} above market`}
                  {diff <= 0 && ` · $${Math.round(Math.abs(diff)).toLocaleString()} below market`}
                </p>
              </div>
            )}

            {/* Similar Listings */}
            {listings.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Similar Vehicles Nearby ({listings.length})
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {listings.slice(0, 5).map((listing, i) => {
                    const card = (
                      <div key={listing.id || i} className={cn(
                        'bg-secondary/50 rounded-lg p-2 text-xs',
                        listing.vdp_url ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors' : ''
                      )}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-semibold text-foreground truncate">
                                {listing.year} {listing.make} {listing.model}
                                {listing.trim && <span className="text-muted-foreground font-normal"> {listing.trim}</span>}
                              </p>
                              {listing.vdp_url && <ExternalLink className="w-2.5 h-2.5 text-blue-400 shrink-0" />}
                            </div>
                            <p className="text-muted-foreground flex items-center gap-0.5 mt-0.5">
                              <MapPin className="w-2.5 h-2.5" />
                              {listing.dealer?.city}, {listing.dealer?.state}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="font-bold text-primary">${listing.price?.toLocaleString()}</p>
                            <p className="text-muted-foreground">{listing.miles?.toLocaleString()} mi</p>
                          </div>
                        </div>
                      </div>
                    );
                    return listing.vdp_url ? (
                      <a key={listing.id || i} href={listing.vdp_url} target="_blank" rel="noopener noreferrer" className="block no-underline">
                        {card}
                      </a>
                    ) : card;
                  })}
                </div>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">* Live MarketCheck inventory data · 100-mile radius</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
