import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Camera, FileText, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PROMPTS = {
  sticker: `You are analyzing a car dealership window sticker or general document. Extract ALL key financial data including: MSRP, selling price, dealer add-ons/accessories with prices, documentation fee, destination charge, APR/interest rate, loan term, monthly payment, trade-in value, rebates/incentives, total financed amount, total cost. Return a structured summary with each line item clearly labeled. Be thorough and precise.`,
  paperwork: `You are a car-deal financial analyst reviewing sales paperwork or a finance & insurance (F&I) contract. Your job is to find every possible way the buyer can save money.

Analyze the document and provide:
1. **Line-by-line breakdown** — list every charge, fee, and add-on with its exact amount.
2. **Red flags** — identify any inflated fees, unnecessary add-ons, or excessive markups (e.g. paint protection, GAP insurance overpriced, VIN etching, extended warranties, dealer prep fees, doc fees above $150, market adjustment fees).
3. **Money-saving opportunities** — for each red flag, state exactly how much can be saved and what to say to the salesperson to remove or reduce it.
4. **Total potential savings** — sum up all identified savings.
5. **APR analysis** — if financing terms are present, flag if the rate seems high and recommend asking about credit union rates.

Be specific with dollar amounts. Format clearly with headers.`
};

export default function DocumentScanner({ onDocumentProcessed, disabled }) {
  const { user } = useAuth();
  const stickerRef = useRef(null);
  const paperworkRef = useRef(null);
  const [uploading, setUploading] = useState(null); // 'sticker' | 'paperwork' | null
  const [scanned, setScanned] = useState([]);

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
    return typeof data === 'string' ? data : data?.content ?? data;
  };

  const handleFile = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(type);
    try {
      const { file_url } = await uploadFile(file);
      
      const result = await invokeLLM({
        prompt: PROMPTS[type],
        file_urls: [file_url],
        model: 'claude-haiku-4-5',
      });

      setScanned(prev => [...prev, { type, url: file_url }]);
      onDocumentProcessed(file_url, result, type);
    } catch (err) {
      console.error('Document scan error:', err);
    }
    setUploading(null);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <input ref={stickerRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFile(e, 'sticker')} />
      <input ref={paperworkRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={e => handleFile(e, 'paperwork')} />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => stickerRef.current?.click()}
          disabled={!!uploading || disabled}
          className="h-11 gap-1.5 text-xs rounded-xl flex-1"
        >
          {uploading === 'sticker' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : scanned.find(s => s.type === 'sticker') ? (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <FileText className="w-3.5 h-3.5" />
          )}
          Sticker
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => paperworkRef.current?.click()}
          disabled={!!uploading || disabled}
          className="h-11 gap-1.5 text-xs rounded-xl flex-1"
        >
          {uploading === 'paperwork' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : scanned.find(s => s.type === 'paperwork') ? (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
          F&I
        </Button>
      </div>
    </div>
  );
}
