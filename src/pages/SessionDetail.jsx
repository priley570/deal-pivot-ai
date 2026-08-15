import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, BarChart2, Loader2, ChevronDown } from 'lucide-react';
import ChatBubble from '@/components/session/ChatBubble';
import VoiceInput from '@/components/session/VoiceInput';
import DocumentScanner from '@/components/session/DocumentScanner';
import MarketComparison from '@/components/session/MarketComparison';

const SYSTEM_PROMPT = `You are DealPivot AI — an expert car negotiation co-pilot helping a buyer negotiate at a dealership RIGHT NOW. Your role:

1. ANALYZE financing offers instantly (APR, loan term, monthly payment, total cost)
2. IDENTIFY hidden markups and dealer add-ons that are unnecessary 
3. PROVIDE specific counter-offer scripts the buyer can say out loud
4. COMPARE dealer offers against market data when available
5. PROTECT the buyer from high-pressure tactics (artificial urgency, payment focus, etc.)
6. RECOMMEND credit union financing when dealer APR is above 5%

COMMUNICATION STYLE:
- Be direct, concise, and actionable
- Use bullet points for multiple insights
- Lead with the most important finding
- Give exact numbers when possible
- Keep responses short enough to read quickly in a showroom
- Use bold for key numbers and action items`;

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showMarket, setShowMarket] = useState(true);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const invokeLLM = async (params) => {
    const { data, error } = await supabase.functions.invoke('invoke-llm', {
      body: params
    });
    if (error) throw error;
    return data.content;
  };

  useEffect(() => {
    const load = async () => {
      if (!user || !id) return;
      
      const [sessionRes, messagesRes] = await Promise.all([
        supabase
          .from('negotiation_sessions')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', id)
          .order('created_at', { ascending: true })
          .limit(50)
      ]);

      if (sessionRes.data) {
        setSession(sessionRes.data);
      }
      if (messagesRes.data) {
        setMessages(messagesRes.data);
      }
    };
    load();
  }, [id, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content, inputMethod = 'text') => {
    if (!content.trim() || !user) return;
    setAiLoading(true);

    // Save user message
    const { data: userMsg } = await supabase
      .from('chat_messages')
      .insert({
        session_id: id,
        user_id: user.id,
        role: 'user',
        content,
        input_method: inputMethod
      })
      .select()
      .single();

    setMessages(prev => [...prev, { ...userMsg, created_at: new Date().toISOString() }]);
    setTextInput('');

    // Build context for AI
    const vehicleInfo = session ? `Vehicle: ${session.vehicle_year || ''} ${session.vehicle_make || ''} ${session.vehicle_model || ''} ${session.vehicle_trim || ''}`.trim() : '';
    const marketInfo = session?.market_avg_price
      ? `Market avg: $${session.market_avg_price?.toLocaleString()}, Target: $${session.fair_target_price?.toLocaleString()}`
      : '';
    const dealerInfo = session?.dealer_asking_price ? `Dealer asking: $${session.dealer_asking_price?.toLocaleString()}` : '';
    const docContext = session?.document_context ? `\n\nDocument context:\n${session.document_context}` : '';
    const history = messages.slice(-6).map(m => `${m.role === 'user' ? 'BUYER' : 'PILOT'}: ${m.content}`).join('\n');

    const contextBlock = [vehicleInfo, marketInfo, dealerInfo].filter(Boolean).join(' | ');

    try {
      const result = await invokeLLM({
        prompt: `${SYSTEM_PROMPT}

${contextBlock ? `SESSION CONTEXT: ${contextBlock}` : ''}${docContext}

${history ? `RECENT CONVERSATION:\n${history}\n` : ''}
BUYER SAYS: ${content}

Respond as DealPivot AI:`,
        model: 'claude-haiku-4-5',
      });

      const aiContent = result;
      const { data: aiMsg } = await supabase
        .from('chat_messages')
        .insert({
          session_id: id,
          user_id: user.id,
          role: 'assistant',
          content: aiContent
        })
        .select()
        .single();
      
      setMessages(prev => [...prev, { ...aiMsg, created_at: new Date().toISOString() }]);
    } catch (err) {
      console.error('AI error:', err);
    }
    setAiLoading(false);
  };

  const handleDocumentProcessed = async (fileUrl, context, type = 'sticker') => {
    const contextStr = typeof context === 'string' ? context : context.content || JSON.stringify(context);
    const updatedContext = session?.document_context
      ? session.document_context + '\n\n---\n\n' + contextStr
      : contextStr;

    const existingUrls = session?.document_urls || [];
    await supabase
      .from('negotiation_sessions')
      .update({
        document_context: updatedContext,
        document_urls: [...existingUrls, fileUrl]
      })
      .eq('id', id);
    
    setSession(prev => ({ ...prev, document_context: updatedContext, document_urls: [...existingUrls, fileUrl] }));

    const msg = type === 'paperwork'
      ? `💰 Sales paperwork analyzed! I've identified all fees, add-ons, and potential savings opportunities above. Ask me "what should I negotiate?" or "how much can I save?" for a specific action plan.`
      : `📄 Document scanned and analyzed. I've extracted the key data. Ask me anything about it — APR analysis, hidden fees, whether to accept this offer, or what to counter with.`;

    const aiMsg = { role: 'assistant', content: msg, created_at: new Date().toISOString(), id: 'doc-' + Date.now() };
    setMessages(prev => [...prev, aiMsg]);
  };

  const handleMarketUpdate = (data) => {
    setSession(prev => ({ ...prev, ...data }));
  };

  if (!session) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border bg-white shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-foreground truncate">{session.title}</h1>
            {session.vehicle_make && (
              <p className="text-xs text-muted-foreground">{session.vehicle_year} {session.vehicle_make} {session.vehicle_model}</p>
            )}
          </div>
          <Link to="/salesperson-show" state={{ session }} className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            <BarChart2 className="w-3.5 h-3.5" />
            Show
          </Link>
        </div>
        <div className="flex gap-2">
          <DocumentScanner onDocumentProcessed={handleDocumentProcessed} disabled={aiLoading} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMarket(v => !v)}
            className="h-11 gap-1 text-xs rounded-xl flex-1"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Pricing
            <ChevronDown className={`w-3 h-3 transition-transform ${showMarket ? 'rotate-180' : ''}`} />
          </Button>
        </div>
        {showMarket && (
          <div className="mt-3">
            <MarketComparison session={session} onUpdate={handleMarketUpdate} />
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center mx-auto mb-3 overflow-hidden">
              <span className="text-white font-bold">DP</span>
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">DealPivot AI is ready</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">Scan a document or start talking. Ask about any offer, APR, fees, or negotiation strategy.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatBubble key={msg.id || i} message={msg} />
        ))}
        {aiLoading && (
          <div className="flex gap-2 items-start">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">AI</span>
            </div>
            <div className="bg-white border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-white shrink-0">
        <div className="flex items-center gap-2">
          <VoiceInput onTranscript={(t) => sendMessage(t, 'voice')} disabled={aiLoading} />
          <div className="flex-1 flex gap-2">
            <Input
              ref={inputRef}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="Ask about this deal..."
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(textInput)}
              disabled={aiLoading}
              className="rounded-full text-sm"
            />
            <Button
              onClick={() => sendMessage(textInput)}
              disabled={!textInput.trim() || aiLoading}
              size="icon"
              className="rounded-full shrink-0 w-10 h-10"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
