import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, MapPin, Star, ExternalLink, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DealerList({ plan, onBack }) {
  const { user } = useAuth();
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
      } else {
        setDealers(data?.dealers || []);
      }
    } catch (e) {
      console.error('Dealers error:', e);
      setError(e.message || 'Failed to load dealers. Please try again.');
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
      <h1 className="text-xl font-bold text-foreground mb-1">Nearby Dealers</h1>
      <p className="text-sm text-muted-foreground mb-4">
        {resolvedZip ? `Within 50 miles of ${resolvedZip}` : 'Finding dealers near you...'}
      </p>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Finding nearby dealers...</p>
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
          <p className="text-sm text-muted-foreground">No dealers found nearby</p>
        </div>
      )}

      <div className="space-y-3">
        {dealers.map((dealer, i) => (
          <Card key={i} className="border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{dealer.name}</h3>
                  {dealer.address && (
                    <p className="text-sm text-muted-foreground mt-0.5">{dealer.address}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {dealer.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-sm font-medium">{dealer.rating}</span>
                      </div>
                    )}
                    {dealer.distance && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Navigation className="w-3.5 h-3.5" />
                        <span className="text-sm">{dealer.distance} mi</span>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleStartNegotiation(dealer)}
                  className="shrink-0 rounded-xl"
                >
                  Start
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
