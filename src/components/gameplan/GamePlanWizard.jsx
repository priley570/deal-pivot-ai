import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Send, Bot, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import PlanSummary from './PlanSummary';
import DealerList from './DealerList';

const SYSTEM_PROMPT = `You are DealPivot's pre-purchase planning assistant. Your job is to have a friendly, focused conversation to help a car buyer build their perfect game plan BEFORE they visit a dealership.

Guide the conversation through these topics (naturally, not as a rigid checklist):
1. New or used vehicle preference
2. Preferred makes/models — and whether they're open to alternatives
3. Body style (SUV, sedan, truck, etc.)
4. Must-have features (AWD, third row, EV, etc.)
5. Budget range (total price they want to spend)
6. ZIP code for finding nearby dealers (within 50 miles)
7. Down payment amount
8. Trade-in vehicle (year/make/model) and estimated value
9. Credit score range (excellent 750+, good 700-749, fair 650-699, building below 650)
10. Preferred loan term (24, 36, 48, 60, 72 months)

IMPORTANT - VEHICLE PRICING RESEARCH:
Once you know the vehicle make/model/condition, use your internet knowledge to look up REAL current market pricing for that vehicle:
- For new vehicles: MSRP range and typical transaction prices
- For used vehicles: typical retail price range based on recent model years
- Search for "2024 [make] [model] price" or similar to get accurate current market data

BUDGET MISMATCH DETECTION:
If the buyer's stated budget is significantly lower than the real market price of their desired vehicle, you MUST clearly point this out. For example: "I should mention that [vehicle] typically starts at $X, which is above your $Y budget. Would you like to adjust your budget, consider a different vehicle, or explore used options that might fit your budget better?" Do NOT silently use their budget as if it were the vehicle price.

When you output the JSON, include a market_price_min and market_price_max field with the REAL market price range you researched for their specific vehicle, NOT their budget. The financing estimates should be based on the actual market price, not their stated budget cap.

After gathering enough info, produce a structured JSON summary. Be conversational and brief. Ask one or two questions at a time. When you have enough info to proceed, say "I have everything I need to build your game plan!" and then output a JSON block wrapped in <PLAN_DATA>...</PLAN_DATA> tags with these fields: condition, budget_min, budget_max, market_price_min, market_price_max, preferred_makes (array), preferred_models (array), open_to_alternatives, body_style, must_have_features (array), zip_code, down_payment, trade_in_value, credit_score_range (one of: excellent_750_plus, good_700_749, fair_650_699, building_below_650), loan_term_months, budget_mismatch (boolean, true if market price exceeds budget by more than 20%), ai_recommendations (a 2-3 sentence plain-English summary of the market situation, any budget concerns, and negotiation tips for this specific vehicle).`;

export default function GamePlanWizard({ plan, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractedPlan, setExtractedPlan] = useState(null);
  const [savedPlan, setSavedPlan] = useState(plan || null);
  const [view, setView] = useState(plan ? 'summary' : 'chat'); // 'chat' | 'summary' | 'dealers'
  const bottomRef = useRef(null);

  const invokeLLM = async (params) => {
    const { data, error } = await supabase.functions.invoke('invoke-llm', {
      body: params
    });
    if (error) throw error;
    return typeof data === 'string' ? data : data?.content ?? data;
  };

  useEffect(() => {
    if (view === 'chat' && messages.length === 0 && !plan) {
      startConversation();
    }
    if (plan) {
      setExtractedPlan(plan);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startConversation = async () => {
    setLoading(true);
    try {
      const greeting = await invokeLLM({
        prompt: `${SYSTEM_PROMPT}\n\nStart the conversation with a warm, one-sentence greeting and your first question to the buyer.`,
        model: 'claude-haiku-4-5',
      });
      setMessages([{ role: 'assistant', content: greeting }]);
    } catch (err) {
      console.error('LLM error:', err);
      setMessages([{ role: 'assistant', content: 'Hi! I\'m your DealPivot Game Plan assistant. Let me help you figure out the perfect car for your needs and budget. First, are you looking at new or used vehicles?' }]);
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !user) return;
    const userMsg = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const history = newMessages.map(m => `${m.role === 'user' ? 'Buyer' : 'DealPivot'}: ${m.content}`).join('\n');
      const reply = await invokeLLM({
        prompt: `${SYSTEM_PROMPT}\n\nConversation so far:\n${history}\n\nContinue the conversation as DealPivot. Use internet search to look up real current pricing for any specific vehicle mentioned. If you have all the info needed, output <PLAN_DATA>{...json...}</PLAN_DATA> and say you're ready.`,
        model: 'claude-haiku-4-5',
      });

      // Check for plan data
      const match = reply.match(/<PLAN_DATA>([\s\S]*?)<\/PLAN_DATA>/);
      let cleanReply = reply.replace(/<PLAN_DATA>[\s\S]*?<\/PLAN_DATA>/g, '').trim();
      setMessages(prev => [...prev, { role: 'assistant', content: cleanReply }]);

      if (match) {
        const planData = JSON.parse(match[1]);
        // Use the AI-researched market price as the basis for financing, not just budget_max
        const vehiclePrice = planData.market_price_min
          ? Math.round((planData.market_price_min + (planData.market_price_max || planData.market_price_min)) / 2)
          : (planData.budget_max || 30000);
        const loanAmt = vehiclePrice - (planData.down_payment || 0) - (planData.trade_in_value || 0);
        const aprMap = { excellent_750_plus: 5.5, good_700_749: 7.5, fair_650_699: 11, building_below_650: 16 };
        const apr = aprMap[planData.credit_score_range] || 8;
        const months = planData.loan_term_months || 60;
        const r = apr / 100 / 12;
        const monthly = loanAmt > 0 ? (loanAmt * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1) : 0;

        const fullPlan = {
          ...planData,
          estimated_apr: apr,
          estimated_loan_amount: Math.round(Math.max(loanAmt, 0)),
          estimated_monthly_payment: Math.round(monthly > 0 ? monthly : 0),
          chat_history: newMessages,
          status: 'shopping',
        };
        setExtractedPlan(fullPlan);

        // Save to DB
        if (savedPlan) {
          const { data: updated } = await supabase
            .from('game_plans')
            .update(fullPlan)
            .eq('id', savedPlan.id)
            .select()
            .single();
          setSavedPlan(updated);
        } else {
          const { data: created } = await supabase
            .from('game_plans')
            .insert({ ...fullPlan, user_id: user.id })
            .select()
            .single();
          setSavedPlan(created);
        }
        setView('summary');
      }
    } catch (err) {
      console.error('LLM error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'I apologize, but I encountered an error. Could you try again?' }]);
    }

    setLoading(false);
  };

  if (view === 'summary' && extractedPlan) {
    return (
      <PlanSummary
        plan={extractedPlan}
        savedPlan={savedPlan}
        onFindDealers={() => setView('dealers')}
        onBack={onClose}
        onContinueChat={() => setView('chat')}
      />
    );
  }

  if (view === 'dealers' && savedPlan) {
    return (
      <DealerList
        plan={extractedPlan}
        onBack={() => setView('summary')}
      />
    );
  }

  // Chat view
  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b border-border shrink-0">
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center overflow-hidden">
            <span className="text-white font-bold">DP</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">Game Plan Assistant</h1>
            <p className="text-xs text-muted-foreground">Powered by DealPivot AI</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-36">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-primary text-white rounded-tr-sm'
                : 'bg-white border border-border rounded-tl-sm text-foreground'
            }`}>
              {m.content}
            </div>
            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-white border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="fixed bottom-[60px] left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-4 pt-2 bg-background border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type your answer..."
            className="rounded-xl"
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()} size="icon" className="rounded-xl shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
