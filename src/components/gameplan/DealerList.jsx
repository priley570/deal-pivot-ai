import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, MapPin, Star, ExternalLink, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DealerList({ plan, onBack }) {
  const [dealers, setDealers] = useState([]);
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
    if (!zip) {
      const user = await base44.auth.me().catch(() => null);
      zip = user?.zip_code;
    }

    if (!zip) {
      setError('No ZIP code found. Please add one in your Profile or provide it during the Game Plan chat.');
      setLoading(false);
      return;
    }

    setResolvedZip(zip);

    try {
      const res = await base44.functions.invoke('findNearbyDealers', {
        zip_code: zip,
        makes: plan?.preferred_makes || [],
      });
      if (res.data?.error) {
        setError(res.data.error);
      } else {
        setDealers(res.data?.dealers || []);
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load dealers. Please try again.');
    }
    setLoading(false);
  };

  const handleStartNegotiation = (dealer) => {
    navigate('/session/new', { state: { dealer_name: dealer.name } });
  };

  return (
    <div className="px-4 pt-6 pb-6 overflow-y-auto h-screen">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Plan
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Nearby Dealers</h1>
          <p className="text-xs text-muted-foreground">Within 25 miles of {resolvedZip}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Searching nearby dealerships...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm text-destructive mb-3">{error}</p>
          <Button onClick={fetchDealers} variant="outline" size="sm">Try Again</Button>
        </div>
      ) : dealers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No dealers found near {resolvedZip}.</p>
      ) : (
        <div className="space-y-3">
          {dealers.map((dealer, i) => (
            <Card key={dealer.place_id || i} className="border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">{dealer.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{dealer.address}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {dealer.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="text-xs font-medium text-foreground">{dealer.rating}</span>
                          {dealer.user_ratings_total && (
                            <span className="text-[10px] text-muted-foreground">({dealer.user_ratings_total.toLocaleString()})</span>
                          )}
                        </div>
                      )}
                      {dealer.open_now !== null && (
                        <span className={`text-[10px] font-medium ${dealer.open_now ? 'text-emerald-600' : 'text-destructive'}`}>
                          {dealer.open_now ? 'Open Now' : 'Closed'}
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={dealer.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-lg gap-1.5 text-xs"
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination_place_id=${dealer.place_id}`, '_blank')}
                  >
                    <Navigation className="w-3 h-3" /> Directions
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 rounded-lg text-xs"
                    onClick={() => handleStartNegotiation(dealer)}
                  >
                    Start Negotiation
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}