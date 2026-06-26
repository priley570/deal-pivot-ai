import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
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
  const stickerRef = useRef(null);
  const paperworkRef = useRef(null);
  const [uploading, setUploading] = useState(null); // 'sticker' | 'paperwork' | null
  const [scanned, setScanned] = useState([]);

  const handleFile = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(type);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: PROMPTS[type],
      file_urls: [file_url],
      model: 'claude_sonnet_4_6'
    });

    setScanned(prev => [...prev, { type, url: file_url }]);
    onDocumentProcessed(file_url, result.content || result, type);
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
          onClick={() => stickerRef.current?.click()}
          disabled={disabled || !!uploading}
          className="h-11 gap-2 text-xs font-medium rounded-xl border-dashed flex-1"
        >
          {uploading === 'sticker' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</>
          ) : (
            <><Camera className="w-4 h-4" /> Scan Sticker</>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={() => paperworkRef.current?.click()}
          disabled={disabled || !!uploading}
          className="h-11 gap-2 text-xs font-medium rounded-xl border-dashed flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
        >
          {uploading === 'paperwork' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
          ) : (
            <><FileText className="w-4 h-4" /> Scan Paperwork</>
          )}
        </Button>
      </div>

      {scanned.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {scanned.map((s, i) => (
            <div key={i} className={`flex items-center gap-1 rounded-full px-2.5 py-1 border ${s.type === 'paperwork' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <CheckCircle className={`w-3 h-3 ${s.type === 'paperwork' ? 'text-amber-600' : 'text-emerald-600'}`} />
              <span className={`text-xs font-medium ${s.type === 'paperwork' ? 'text-amber-700' : 'text-emerald-700'}`}>
                {s.type === 'paperwork' ? 'Paperwork' : 'Sticker'} {i + 1}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}