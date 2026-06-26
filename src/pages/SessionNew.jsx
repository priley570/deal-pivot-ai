import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, Loader2, Car, FileImage, ScanLine, Target } from 'lucide-react';

export default function SessionNew() {
  const navigate = useNavigate();
  const location = useLocation();
  const [vin, setVin] = useState('');
  const [dealerName, setDealerName] = useState(location.state?.dealer_name || '');
  const [askingPrice, setAskingPrice] = useState('');
  const [vinData, setVinData] = useState(null);
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState('');
  const [creating, setCreating] = useState(false);
  const [scanning, setScanning] = useState(null); // 'vin' | 'sticker' | null
  const [gamePlans, setGamePlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const vinCameraRef = useRef(null);
  const stickerCameraRef = useRef(null);

  useEffect(() => {
    base44.entities.GamePlan.list('-created_date', 10).then(setGamePlans).catch(() => {});
  }, []);

  const handleVinScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning('vin');
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Look at this image of a vehicle VIN label or door jamb sticker. Extract ONLY the 17-character VIN number. Return just the VIN characters, nothing else. If you cannot find a VIN, return the word "NOT_FOUND".`,
      file_urls: [file_url],
      model: 'claude_sonnet_4_6',
    });
    const extracted = result?.trim().replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
    if (extracted && extracted.length >= 11 && extracted !== 'NOT_FOUND') {
      setVin(extracted);
      setVinError('');
      setVinData(null);
    } else {
      setVinError('Could not read VIN from image. Please type it manually.');
    }
    setScanning(null);
    e.target.value = '';
  };

  const handleStickerScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning('sticker');
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze this car window sticker or Monroney label. Extract: VIN, year, make, model, trim level, engine description, drivetrain/drive type, and MSRP. Return as JSON.`,
      file_urls: [file_url],
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          vin: { type: 'string' },
          year: { type: 'string' },
          make: { type: 'string' },
          model: { type: 'string' },
          trim: { type: 'string' },
          engine: { type: 'string' },
          drive: { type: 'string' },
          msrp: { type: 'number' },
        }
      }
    });
    if (result?.make) {
      setVinData({ year: result.year, make: result.make, model: result.model, trim: result.trim, engine: result.engine, drive: result.drive });
      if (result.vin) setVin(result.vin.toUpperCase());
      if (result.msrp) setAskingPrice(String(result.msrp));
    } else {
      setVinError('Could not read window sticker. Try a clearer photo.');
    }
    setScanning(null);
    e.target.value = '';
  };

  const decodeVin = async () => {
    if (vin.length < 11) { setVinError('Enter at least 11 characters'); return; }
    setVinLoading(true);
    setVinError('');
    setVinData(null);
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
    const data = await res.json();
    const results = data.Results;
    const get = (var_) => results.find(r => r.Variable === var_)?.Value || '';
    const year = get('Model Year');
    const make = get('Make');
    const model = get('Model');
    const trim = get('Trim');
    const engine = get('Engine Number of Cylinders') ? `${get('Engine Number of Cylinders')}-cyl` : '';
    const drive = get('Drive Type');
    if (!make || make === 'Not Applicable') { setVinError('VIN not found. Please check and try again.'); setVinLoading(false); return; }
    setVinData({ year, make, model, trim, engine, drive });
    setVinLoading(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    const vehicle = vinData || {};
    const title = vinData
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${dealerName ? ' at ' + dealerName : ''}`
      : dealerName ? `Negotiation at ${dealerName}` : 'New Negotiation';

    const selectedPlan = gamePlans.find(p => p.id === selectedPlanId);

    const session = await base44.entities.NegotiationSession.create({
      title,
      status: 'active',
      vin: vin || undefined,
      vehicle_year: vehicle.year,
      vehicle_make: vehicle.make,
      vehicle_model: vehicle.model,
      vehicle_trim: vehicle.trim,
      vehicle_engine: vehicle.engine,
      vehicle_drivetrain: vehicle.drive,
      dealer_name: dealerName || undefined,
      dealer_asking_price: askingPrice ? parseFloat(askingPrice) : undefined,
      ...(selectedPlan ? {
        notes: `Game Plan: ${selectedPlan.preferred_makes?.join(', ') || 'Any'} | Budget: $${(selectedPlan.budget_min || 0).toLocaleString()}–$${(selectedPlan.budget_max || 0).toLocaleString()} | Credit: ${selectedPlan.credit_score_range || 'unknown'} | Down: $${(selectedPlan.down_payment || 0).toLocaleString()} | Trade-in: $${(selectedPlan.trade_in_value || 0).toLocaleString()}`,
      } : {}),
    });
    navigate(`/session/${session.id}`);
  };

  return (
    <div className="px-4 pt-6 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-2xl font-display font-bold text-foreground mb-1">New Session</h1>
      <p className="text-sm text-muted-foreground mb-6">Enter vehicle details to start your negotiation co-pilot.</p>

      {/* Hidden camera inputs */}
      <input ref={vinCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleVinScan} />
      <input ref={stickerCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleStickerScan} />

      {/* Game Plan Picker */}
      {gamePlans.length > 0 && (
        <div className="mb-5">
          <Label className="text-sm font-semibold mb-2 block flex items-center gap-1.5">
            <Target className="w-4 h-4 text-primary" /> Load from Game Plan <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Select value={selectedPlanId} onValueChange={(val) => {
            setSelectedPlanId(val);
            const plan = gamePlans.find(p => p.id === val);
            if (plan) {
              if (plan.preferred_makes?.length) setDealerName('');
              if (plan.dealer_asking_price) setAskingPrice(String(plan.dealer_asking_price));
            }
          }}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select a game plan..." />
            </SelectTrigger>
            <SelectContent>
              {gamePlans.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.preferred_makes?.join(', ') || 'Any'} · {p.condition || 'Any'} · ${(p.budget_max || 0).toLocaleString()} max
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPlanId && (() => {
            const plan = gamePlans.find(p => p.id === selectedPlanId);
            return plan ? (
              <div className="mt-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-foreground space-y-0.5">
                {plan.preferred_makes?.length > 0 && <p><span className="font-medium">Makes:</span> {plan.preferred_makes.join(', ')}</p>}
                {plan.body_style && <p><span className="font-medium">Body Style:</span> {plan.body_style}</p>}
                {plan.budget_max && <p><span className="font-medium">Budget:</span> ${(plan.budget_min || 0).toLocaleString()} – ${plan.budget_max.toLocaleString()}</p>}
                {plan.credit_score_range && <p><span className="font-medium">Credit:</span> {plan.credit_score_range.replace(/_/g, ' ')}</p>}
                {plan.zip_code && <p><span className="font-medium">ZIP:</span> {plan.zip_code}</p>}
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Camera Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => stickerCameraRef.current?.click()}
          disabled={!!scanning}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed border-primary/30 bg-blue-50/50 hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-60"
        >
          {scanning === 'sticker' ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <FileImage className="w-6 h-6 text-primary" />}
          <div className="text-center">
            <p className="text-xs font-semibold text-foreground">Scan Window Sticker</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Auto-fills all vehicle info</p>
          </div>
        </button>
        <button
          onClick={() => vinCameraRef.current?.click()}
          disabled={!!scanning}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border bg-secondary/30 hover:bg-secondary/50 active:scale-95 transition-all disabled:opacity-60"
        >
          {scanning === 'vin' ? <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" /> : <ScanLine className="w-6 h-6 text-muted-foreground" />}
          <div className="text-center">
            <p className="text-xs font-semibold text-foreground">Scan VIN Label</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Door jamb or windshield</p>
          </div>
        </button>
      </div>

      {/* VIN Decoder */}
      <div className="mb-5">
        <Label className="text-sm font-semibold mb-2 block">Or Enter VIN Manually</Label>
        <div className="flex gap-2">
          <Input
            value={vin}
            onChange={e => { setVin(e.target.value.toUpperCase()); setVinError(''); setVinData(null); }}
            placeholder="1HGBH41JXMN109186"
            className="font-mono text-sm uppercase tracking-widest"
            maxLength={17}
          />
          <Button onClick={decodeVin} disabled={vinLoading || vin.length < 11} variant="outline" className="shrink-0">
            {vinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
        {vinError && <p className="text-xs text-destructive mt-1">{vinError}</p>}
        <p className="text-xs text-muted-foreground mt-1">Found on the door jamb, windshield, or registration.</p>
      </div>

      {vinData && (
        <Card className="border-primary/20 bg-blue-50 mb-5">
          <CardContent className="p-4 flex gap-3 items-start">
            <Car className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">{vinData.year} {vinData.make} {vinData.model}</p>
              {vinData.trim && <p className="text-xs text-muted-foreground">{vinData.trim}</p>}
              {(vinData.engine || vinData.drive) && (
                <p className="text-xs text-muted-foreground">{[vinData.engine, vinData.drive].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dealer Info */}
      <div className="mb-5">
        <Label className="text-sm font-semibold mb-2 block">Dealership Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input value={dealerName} onChange={e => setDealerName(e.target.value)} placeholder="e.g. AutoNation Honda" />
      </div>

      <div className="mb-8">
        <Label className="text-sm font-semibold mb-2 block">Dealer's Asking Price <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
          <Input
            value={askingPrice}
            onChange={e => setAskingPrice(e.target.value)}
            placeholder="32,500"
            className="pl-7"
            type="number"
          />
        </div>
      </div>

      <Button onClick={handleCreate} disabled={creating} className="w-full h-14 text-base font-semibold rounded-2xl shadow-md shadow-primary/20 gap-2">
        {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
        Launch Co-Pilot
      </Button>
    </div>
  );
}