import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingDown, TrendingUp, Minus, RefreshCw, Loader2, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MarketComparison({ session, onUpdate }) {
  const [loading, setLoading] = useState(false);

  const fetchMarket = async () => {
    if (!session.vehicle_make || !session.vehicle_model) return;
    setLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
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

    const data = typeof result === 'string' ? JSON.parse(result) : result;
    await base44.entities.NegotiationSession.update(session.id, {
      market_low_price: data.market_low_price,
      market_avg_price: data.market_avg_price,
      market_high_price: data.market_high_price,
      fair_target_price: data.fair_target_price,
    });
    onUpdate({ ...data });
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

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Market Comparison</CardTitle>
          </div>
          {(session.vehicle_make) && (
            <Button variant="ghost" size="sm" onClick={fetchMarket} disabled={loading} className="h-7 px-2 text-xs gap-1">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {hasData ? 'Refresh' : 'Get Prices'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {!hasData && !loading && (
          <p className="text-xs text-muted-foreground text-center py-3">
            {session.vehicle_make ? 'Tap "Get Prices" to fetch market data.' : 'Add a VIN first to enable market pricing.'}
          </p>
        )}
        {loading && (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Fetching market data...</p>
          </div>
        )}
        {hasData && !loading && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Market Low', value: session.market_low_price, color: 'text-emerald-600' },
                { label: 'Avg. Price', value: session.market_avg_price, color: 'text-foreground' },
                { label: 'Market High', value: session.market_high_price, color: 'text-amber-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center bg-secondary rounded-xl p-2.5">
                  <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                  <p className={cn('text-sm font-bold', color)}>${value?.toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Your Target Price</p>
                <p className="text-lg font-bold text-primary">${session.fair_target_price?.toLocaleString()}</p>
              </div>
              {dealerPrice && <p className="text-xs text-muted-foreground">Dealer: <span className="font-semibold text-foreground">${dealerPrice?.toLocaleString()}</span></p>}
            </div>

            {priceStatus && (
              <div className={cn('flex items-center gap-2 rounded-xl p-2.5', statusConfig[priceStatus].bg)}>
                {priceStatus === 'good-deal' ? <TrendingDown className={cn('w-4 h-4', statusConfig[priceStatus].color)} /> : <TrendingUp className={cn('w-4 h-4', statusConfig[priceStatus].color)} />}
                <p className={cn('text-xs font-semibold', statusConfig[priceStatus].color)}>
                  {statusConfig[priceStatus].label}
                  {diff > 0 && ` · $${diff.toLocaleString()} above target`}
                  {diff <= 0 && ` · $${Math.abs(diff).toLocaleString()} below target`}
                </p>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">* AI-estimated prices. Verify with local market data.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}