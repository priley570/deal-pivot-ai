import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingDown, TrendingUp, Minus, RefreshCw, Loader2, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Strip markdown code fences and extract JSON
const extractJSON = (str) => {
  if (typeof str !== 'string') return str;
  // Remove ```json ... ``` or ``` ... ``` wrappers
  const fenced = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Try to find a JSON object directly
  const objMatch = str.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return str.trim();
};

export default function MarketComparison({ session, onUpdate }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const invokeLLM = async (params) => {
    const { data, error } = await supabase.functions.invoke('invoke-llm', {
      body: params
    });
    if (error) throw error;
    return typeof data === 'string' ? data : data?.content ?? data;
  };

  const fetchMarket = async () => {
    if (!session.vehicle_make || !session.vehicle_model || !user) return;
    setLoading(true);
    setFetchError(null);
    try {
      const result = await invokeLLM({
        prompt: `You are a car pricing expert. Provide realistic current market pricing data for a ${session.vehicle_year || ''} ${session.vehicle_make} ${session.vehicle_model} ${session.vehicle_trim || ''}.
      
      Return ONLY a JSON object with these exact fields (numbers only, no $ signs):
      {
        "market_low_price": <lowest realistic price in current market>,
        "market_avg_price": <average transaction price>,
        "market_high_price": <highest typical asking price>,
        "fair_target_price": <the price a savvy buyer should target>,
        "pricing_notes": "<2-3 sentence explanation of market conditions>"
      }
      
      Base this on real market knowledge for ${new Date().getFullYear()}. Be realistic and specific.`,
        response_json_schema: {
          type: "object",
          properties: {
            market_low_price: { type: "number" },
            market_avg_price: { type: "number" },
            market_high_price: { type: "number" },
            fair_target_price: { type: "number" },
            pricing_notes: { type: "string" }
          }
        }
      });

      let data;
      try {
        const cleaned = extractJSON(result);
        data = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned;
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr, 'Raw result:', result);
        throw new Error('Could not parse pricing data from AI response');
      }
      if (!data || typeof data.market_avg_price === 'undefined') {
        throw new Error('Incomplete pricing data returned');
      }

      await supabase
        .from('negotiation_sessions')
        .update({
          market_low_price: data.market_low_price,
          market_avg_price: data.market_avg_price,
          market_high_price: data.market_high_price,
          fair_target_price: data.fair_target_price,
        })
        .eq('id', session.id);
      
      onUpdate({ ...data });
    } catch (err) {
      console.error('Market fetch error:', err);
      setFetchError(err.message || 'Failed to fetch market data');
    }
    setLoading(false);
  };

  const hasData = session.market_avg_price;
  const dealerPrice = session.dealer_asking_price;
  const fairPrice = session.fair_target_price;
  const diff = dealerPrice && fairPrice ? dealerPrice - fairPrice : null;

  const priceStatus = diff === null ? null : diff > 2000 ? 'overpaying' : diff > 0 ? 'slightly-high' : 'good-deal';

  const statusConfig = {
    'overpaying': { label: 'Above Market', color: 'text-destructive', bg: 'bg-red-50', Icon: TrendingUp },
    'slightly-high': { label: 'Slightly High', color: 'text-amber-600', bg: 'bg-amber-50', Icon: TrendingUp },
    'good-deal': { label: 'Good Price', color: 'text-emerald-600', bg: 'bg-emerald-50', Icon: TrendingDown },
  };

  const config = statusConfig[priceStatus];

  return (
    <Card className={cn("border-border shadow-sm", config?.bg)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="w-4 h-4" />
            Market Pricing
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchMarket}
            disabled={loading || !session.vehicle_make || !session.vehicle_model}
            className="h-7 px-2 text-xs"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {fetchError && (
          <p className="text-xs text-destructive">{fetchError}</p>
        )}
        {!hasData ? (
          <p className="text-xs text-muted-foreground">
            {!session.vehicle_make || !session.vehicle_model
              ? 'Enter vehicle details to see market pricing'
              : 'Click refresh to fetch market data'}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Market Low</p>
                <p className="font-semibold">${session.market_low_price?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Market Avg</p>
                <p className="font-semibold">${session.market_avg_price?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Market High</p>
                <p className="font-semibold">${session.market_high_price?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Target Price</p>
                <p className="font-semibold text-primary">${session.fair_target_price?.toLocaleString()}</p>
              </div>
            </div>
            {diff !== null && config && (
              <div className={cn("flex items-center gap-2 p-2 rounded-lg", config.bg)}>
                <config.Icon className={cn("w-4 h-4", config.color)} />
                <span className={cn("text-xs font-medium", config.color)}>
                  {config.label}: {diff > 0 ? '+' : ''}${diff.toLocaleString()}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
