import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { canNegotiate } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, Loader2, Car, FileImage, ScanLine, Target, Lock, Star } from 'lucide-react';

export default function SessionNew() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
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
    const loadGamePlans = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('game_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setGamePlans(data);
    };
    loadGamePlans();
  }, [user]);

  const uploadFile = async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, file);
    
    if (error) throw error;
    
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);
    
    return { file_url: urlData.publicUrl };
  };

  const invokeLLM = async (params) => {
    const { data, error } = await supabase.functions.invoke('invoke-llm', {
      body: params
    });
    if (error) throw error;
    // Edge function returns the text string directly (not wrapped in {content})
    return data;
  };

  const handleVinScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setScanning('vin');
    try {
      const { file_url } = await uploadFile(file);
      const result = await invokeLLM({
        prompt: `Look at this image of a vehicle VIN label or door jamb sticker. Extract ONLY the 17-character VIN number. Return just the VIN characters, nothing else. If you cannot find a VIN, return the word "NOT_FOUND".`,
        file_urls: [file_url],
        model: 'claude-sonnet-4-5',
      });
      const extracted = result?.trim().replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
      if (extracted && extracted.length >= 11 && extracted !== 'NOT_FOUND') {
        setVin(extracted);
        setVinError('');
        setVinData(null);
      } else {
        setVinError('Could not read VIN from image. Please type it manually.');
      }
    } catch (err) {
      console.error('VIN scan error:', err);
      setVinError('Could not read VIN from image. Please type it manually.');
    }
    setScanning(null);
    e.target.value = '';
  };

  const handleStickerScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setScanning('sticker');
    setVinError('');
    try {
      const { file_url } = await uploadFile(file);
      const result = await invokeLLM({
        prompt: `This is a car window sticker (Monroney label) photo taken at a dealership. Extract the following and return ONLY a valid JSON object, no explanation, no markdown fences:
{
  "vin": "17-character VIN or null",
  "year": "model year as 4-digit string",
  "make": "manufacturer name e.g. Kia Toyota Ford",
  "model": "model name e.g. Sorento Camry F-150",
  "trim": "trim level e.g. EX LX Sport",
  "engine": "engine description e.g. 2.5T 3.5L V6",
  "drive": "drivetrain e.g. AWD FWD RWD 4WD",
  "msrp": total MSRP as integer with no dollar sign or commas,
  "dealer_name": "dealership name visible on sticker or null",
  "dealer_city": "dealership city or null",
  "dealer_state": "2-letter state abbreviation or null"
}
The dealer name is usually printed at the top or bottom of the sticker. Total MSRP is the largest dollar amount at the bottom of the price list. If a field is not visible use null. Return ONLY the JSON object.`,
        file_urls: [file_url],
        model: 'claude-sonnet-4-5',
      });
      // Strip markdown fences if present, then parse JSON
      let parsed = null;
      try {
        const raw = typeof result === 'string' ? result : JSON.stringify(result);
        const match = raw.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : JSON.parse(raw);
      } catch (parseErr) {
        console.error('Sticker JSON parse error:', parseErr, 'Raw:', result);
      }
      if (parsed?.make) {
        setVinData({ year: parsed.year, make: parsed.make, model: parsed.model, trim: parsed.trim, engine: parsed.engine, drive: parsed.drive });
        if (parsed.vin) setVin(String(parsed.vin).toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/gi, ''));
        if (parsed.msrp) setAskingPrice(String(parsed.msrp));
        // Auto-populate dealer name from sticker if not already entered
        if (parsed.dealer_name && !dealerName) {
          const cityState = [parsed.dealer_city, parsed.dealer_state].filter(Boolean).join(', ');
          setDealerName(cityState ? `${parsed.dealer_name} — ${cityState}` : parsed.dealer_name);
        }
        setVinError('');
      } else {
        setVinError('Could not read window sticker. Try a clearer photo or enter VIN manually.');
      }
    } catch (err) {
      console.error('Sticker scan error:', err);
      setVinError('Could not read window sticker. Try a clearer photo or enter VIN manually.');
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
    if (!user) return;
    setCreating(true);
    const vehicle = vinData || {};
    const selectedPlan = gamePlans.find(p => p.id === selectedPlanId);

    // Resolve vehicle fields — VIN decode wins; fall back to game plan data
    const resolvedYear  = vehicle.year  || null;
    const resolvedMake  = vehicle.make  || selectedPlan?.preferred_makes?.[0]  || null;
    const resolvedModel = vehicle.model || selectedPlan?.preferred_models?.[0] || null;

    // Build a meaningful title: prefer specific vehicle, fall back to dealer, then generic
    const vehicleStr = [resolvedYear, resolvedMake, resolvedModel].filter(Boolean).join(' ');
    const title = vehicleStr
      ? `${vehicleStr}${dealerName ? ' at ' + dealerName : ''}`
      : dealerName
        ? `Negotiation at ${dealerName}`
        : 'New Negotiation';

    const sessionData = {
      user_id: user.id,
      title,
      status: 'active',
      vin: vin || null,
      vehicle_year: resolvedYear,
      vehicle_make: resolvedMake,
      vehicle_model: resolvedModel,
      vehicle_trim: vehicle.trim || null,
      vehicle_engine: vehicle.engine || null,
      vehicle_drivetrain: vehicle.drive || null,
      dealer_name: dealerName || null,
      dealer_asking_price: askingPrice ? parseFloat(askingPrice) : null,
    };

    if (selectedPlan) {
      sessionData.notes = `Game Plan: ${selectedPlan.preferred_makes?.join(', ') || 'Any'} | Budget: $${(selectedPlan.budget_min || 0).toLocaleString()}–$${(selectedPlan.budget_max || 0).toLocaleString()} | Credit: ${selectedPlan.credit_score_range || 'unknown'} | Down: $${(selectedPlan.down_payment || 0).toLocaleString()} | Trade-in: $${(selectedPlan.trade_in_value || 0).toLocaleString()} | ZIP: ${selectedPlan.zip_code || user?.zip_code || 'N/A'}`;
    }

    const { data: session, error } = await supabase
      .from('negotiation_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      console.error('Create session error:', error);
      setCreating(false);
      return;
    }

    navigate(`/session/${session.id}`);
  };

  // Hard gate: if user somehow navigates here directly without negotiate access, show upgrade wall
  if (!canNegotiate(user?.subscription_tier)) {
    return (
      <div className="px-4 pt-6 pb-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Upgrade to Negotiate</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Live AI negotiation coaching is available on Launchpad ($49.99 / 30 days) and Showroom Pro ($119.99 / yr).
          Your Starter plan includes Game Plan and research tools.
        </p>
        <div className="w-full max-w-xs space-y-3 mb-6">
          <div className="flex items-center justify-between p-3 rounded-xl border-2 border-primary bg-blue-50">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              <div className="text-left">
                <p className="text-sm font-bold text-foreground">Launchpad</p>
                <p className="text-xs text-muted-foreground">30-day negotiation pass</p>
              </div>
            </div>
            <p className="text-sm font-bold text-primary">$49.99</p>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl border border-border">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-muted-foreground" />
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Showroom Pro</p>
                <p className="text-xs text-muted-foreground">Annual pass · Best value</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-foreground">$119.99 / yr</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/profile')}
          className="w-full max-w-xs h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
        >
          View Plans
        </button>
        <button onClick={() => navigate(-1)} className="mt-3 text-sm text-muted-foreground">
          Go back
        </button>
      </div>
    );
  }

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
              <p className="text-xs text-emerald-600 font-medium mt-1">✓ Sticker scanned — dealer name and price filled below</p>
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
