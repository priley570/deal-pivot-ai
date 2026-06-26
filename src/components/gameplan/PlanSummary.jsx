import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, MessageSquare, Car, DollarSign, CreditCard, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';

const creditLabel = {
  excellent_750_plus: 'Excellent (750+)',
  good_700_749: 'Good (700–749)',
  fair_650_699: 'Fair (650–699)',
  building_below_650: 'Building (below 650)',
};

export default function PlanSummary({ plan, onFindDealers, onBack, onContinueChat }) {
  return (
    <div className="px-4 pt-6 pb-24 overflow-y-auto h-screen">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Plans
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Your Game Plan</h1>
          <p className="text-xs text-muted-foreground">Review your plan before hitting the dealerships</p>
        </div>
      </div>

      {/* Budget mismatch warning */}
      {plan.budget_mismatch && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-700 mb-0.5">Budget vs. Market Price Gap</p>
            <p className="text-xs text-amber-600 leading-relaxed">
              The market price for your desired vehicle exceeds your stated budget. Financing estimates below are based on the actual vehicle price.
            </p>
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {plan.ai_recommendations && (
        <Card className="border-primary/20 bg-primary/5 shadow-sm mb-4">
          <CardContent className="px-4 py-3 flex gap-3">
            <TrendingUp className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-foreground leading-relaxed">{plan.ai_recommendations}</p>
          </CardContent>
        </Card>
      )}

      {/* Vehicle */}
      <Card className="border-border shadow-sm mb-4">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Car className="w-4 h-4 text-primary" /> Target Vehicle</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <Row label="Condition" value={plan.condition === 'either' ? 'New or Used' : plan.condition?.charAt(0).toUpperCase() + plan.condition?.slice(1)} />
          {plan.preferred_makes?.length > 0 && <Row label="Makes" value={plan.preferred_makes.join(', ')} />}
          {plan.preferred_models?.length > 0 && <Row label="Models" value={plan.preferred_models.join(', ')} />}
          {plan.body_style && <Row label="Body Style" value={plan.body_style} />}
          {plan.open_to_alternatives !== undefined && <Row label="Open to Alternatives" value={plan.open_to_alternatives ? 'Yes' : 'No'} />}
          {plan.must_have_features?.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Must-Have Features</p>
              <div className="flex flex-wrap gap-1">
                {plan.must_have_features.map(f => <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget */}
      <Card className="border-border shadow-sm mb-4">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Budget</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {plan.budget_min && <Row label="Your Budget Min" value={`$${plan.budget_min.toLocaleString()}`} />}
          {plan.budget_max && <Row label="Your Budget Max" value={`$${plan.budget_max.toLocaleString()}`} />}
          {plan.market_price_min && <Row label="Market Price Low" value={`$${plan.market_price_min.toLocaleString()}`} highlight />}
          {plan.market_price_max && <Row label="Market Price High" value={`$${plan.market_price_max.toLocaleString()}`} highlight />}
          {plan.down_payment > 0 && <Row label="Down Payment" value={`$${plan.down_payment.toLocaleString()}`} />}
          {plan.trade_in_value > 0 && <Row label="Trade-In Value" value={`$${plan.trade_in_value.toLocaleString()}`} />}
        </CardContent>
      </Card>

      {/* Financing Estimate */}
      <Card className="border-primary/20 bg-blue-50 shadow-sm mb-4">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> AI Financing Estimate</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {plan.credit_score_range && <Row label="Credit Score" value={creditLabel[plan.credit_score_range] || plan.credit_score_range} />}
          {plan.loan_term_months && <Row label="Loan Term" value={`${plan.loan_term_months} months`} />}
          {plan.estimated_loan_amount > 0 && <Row label="Est. Loan Amount" value={`$${plan.estimated_loan_amount.toLocaleString()}`} />}
          {plan.estimated_apr && <Row label="Est. APR" value={`${plan.estimated_apr}%`} highlight />}
          {plan.estimated_monthly_payment > 0 && (
            <div className="mt-3 bg-white rounded-xl p-3 text-center border border-primary/20">
              <p className="text-xs text-muted-foreground mb-0.5">Estimated Monthly Payment</p>
              <p className="text-3xl font-bold text-primary">${plan.estimated_monthly_payment.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p className="text-[10px] text-muted-foreground mt-1">AI estimate only · actual rates may vary</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-3 fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-5 pt-3 bg-background border-t border-border">
        {plan.zip_code && (
          <Button onClick={onFindDealers} className="w-full h-12 rounded-xl gap-2">
            <MapPin className="w-4 h-4" /> Find Nearby Dealers
          </Button>
        )}
        <Button onClick={onContinueChat} variant="outline" className="w-full h-12 rounded-xl gap-2">
          <MessageSquare className="w-4 h-4" /> Refine My Plan
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xs font-semibold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}