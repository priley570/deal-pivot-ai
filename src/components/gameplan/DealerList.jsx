import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, MapPin, Car, ExternalLink, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DealerList({ plan, onBack }) {
  const { user } = useAuth();
  const [dealers, setDealers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvedZip, setResolvedZip] = useState('');
  const navigate = useNavigate();

  useEffect(() => { fetchDealers(); }, []);

  const fetchDealers = async () => {
    setLoading(true);
    setError('');

    // Resolve zip: plan first, then user profile
    let zip = plan?.zip_code;
    if (!zip && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('zip_code')
        .eq('id', user.id)
        .single();
      zip = profile?.zip_code;
    }

    if (!zip) {
      setError('No ZIP code found. Please add one in your Profile or provide it during the Game Plan chat.');
      setLoading(false);
      return;
    }

    setResolvedZip(zip);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('findNearbyDealers', {
        body: {
          zip_code: zip,
          makes: plan?.preferred_makes || [],
        }
      });
      if (fnError) throw fnError;
      if (data?.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // Edge Function returns listings (individual vehicles). Deduplicate by dealer name.
      const listings = data?.listings || [];
      const dealerMap = new Map();
      for (const listing of listings) {
        const name = listing.dealer?.name || 'Unknown Dealer';
        if (!dealerMap.has(name)) {
          dealerMap.set(name, {
            name,
            city: listing.dealer?.city || '',
            state: listing.dealer?.state || '',
            maps_url: listing.maps_url,
            inventory: [],
          });
        }
        dealerMap.get(name).inventory.push(listing);
      }

      setDealers(Array.from(dealerMap.values()));
      setStats(data?.stats || null);
    } catch (e) {
      console.error('Dealers error:', e);
      setError(e.message || 'Failed to load dealers. Please try again.');
    }
    setLoading(false);
  };

  const handleStartNegotiation = (dealer) => {
    navigate('/session/new', { state: { dealer_name: dealer.name } });
  };

  const makes = plan?.preferred_makes?.join(', ') || 'any make';

  return (
    <div className="px-4 pt-6 pb-6 overflow-y-auto h-screen">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Plan
      </button>
      <h1 className="text-xl font-bold text-foreground mb-1">Nearby Dealers</h1>
      <p className="text-sm text-muted-foreground mb-4">
        {resolvedZip
          ? `${makes} inventory within 50 miles of ${resolvedZip}`
          : 'Finding dealers near you...'}
      </p>

      {stats && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-secondary rounded-xl p-3 text-center">
            <p className="text-lg font-bold">{stats.count}</p>
            <p className="text-[10px] text-muted-foreground">Listings</p>
          </div>
          <div className="bg-secondary rounded-xl p-3 text-center">
            <p className="text-lg font-bold">{dealers.length}</p>
            <p className="text-[10px] text-muted-foreground">Dealers</p>
          </div>
          <div className="bg-secondary rounded-xl p-3 text-center">
            <p className="text-lg font-bold">{stats.avg_price ? `$${Math.round(stats.avg_price / 1000)}k` : '—'}</p>
            <p className="text-[10px] text-muted-foreground">Avg Price</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Searching nearby inventory...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm mb-4">
          {error}
        </div>
      )}

      {!loading && !error && dealers.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-foreground mb-1">No inventory found nearby</p>
          <p className="text-xs text-muted-foreground">Try a different make or expand your search area in your game plan</p>
        </div>
      )}

      <div className="space-y-3">
        {dealers.map((dealer, i) => {
          const cheapest = dealer.inventory.reduce((min, l) => (l.price && (!min || l.price < min.price)) ? l : min, null);
          const priceRange = dealer.inventory
            .map(l => l.price)
            .filter(Boolean)
            .sort((a, b) => a - b);
          const minP = priceRange[0];
          const maxP = priceRange[priceRange.length - 1];

          return (
            <Card key={i} className="border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground leading-tight">{dealer.name}</h3>
                    {(dealer.city || dealer.state) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{[dealer.city, dealer.state].filter(Boolean).join(', ')}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {dealer.maps_url && (
                      <a
                        href={dealer.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border hover:bg-secondary"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </a>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleStartNegotiation(dealer)}
                      className="rounded-xl h-8 px-3 text-xs"
                    >
                      Start
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Car className="w-3.5 h-3.5" />
                    <span>{dealer.inventory.length} listing{dealer.inventory.length !== 1 ? 's' : ''}</span>
                  </div>
                  {minP && (
                    <span className="text-foreground font-medium">
                      {minP === maxP
                        ? `$${minP.toLocaleString()}`
                        : `$${minP.toLocaleString()} – $${maxP.toLocaleString()}`}
                    </span>
                  )}
                </div>

                {cheapest && (
                  <div className="mt-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-1.5">
                    Best: {cheapest.year} {cheapest.make} {cheapest.model} {cheapest.trim || ''} · {cheapest.miles?.toLocaleString()} mi
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
