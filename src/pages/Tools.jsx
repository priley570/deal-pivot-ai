import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Landmark,
  ShieldCheck,
  ChevronRight,
  Car,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

function getSessionTitle(session) {
  const parts = [session.vehicle_year, session.vehicle_make, session.vehicle_model].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return session.title || 'New Negotiation';
}

export default function Tools() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recentSession, setRecentSession] = useState(null);

  // Pull the most recent active negotiation so we can show the linked VIN
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('negotiation_sessions')
        .select('id, title, vin, vehicle_year, vehicle_make, vehicle_model, vehicle_trim, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data) setRecentSession(data);
    };
    load();
  }, [user]);

  const tools = [
    {
      id: 'financing',
      icon: Landmark,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      title: 'Auto Financing',
      subtitle: 'Credit unions & lenders',
      description:
        'Compare pre-qualified auto loan rates from credit unions and banks. See real APR offers based on your credit profile before you set foot in the F&I office.',
      features: [
        'Rate comparison across multiple lenders',
        'Credit union pre-qualification',
        'Payment calculator with your VIN',
        'Loan term optimizer',
      ],
    },
    {
      id: 'insurance',
      icon: ShieldCheck,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      title: 'Insurance Quotes',
      subtitle: 'Coverage before you sign',
      description:
        'Get insurance quotes for a specific vehicle before you buy. Know your day-1 premium and avoid being upsold dealer add-on coverage you don\'t need.',
      features: [
        'Multi-carrier quote comparison',
        'VIN-linked accurate pricing',
        'Coverage recommendation engine',
        'Dealer add-on vs. real policy cost',
      ],
    },
  ];

  return (
    <div className="px-4 pt-6 pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground mb-1">Tools</h1>
        <p className="text-sm text-muted-foreground">
          Financial tools to power your purchase — financing and insurance, right from the app.
        </p>
      </div>

      {/* VIN context banner — shows if user has a recent negotiation */}
      {recentSession?.vin && (
        <button
          onClick={() => navigate(`/session/${recentSession.id}`)}
          className="w-full mb-5 p-3 rounded-2xl bg-blue-50 border border-blue-100 flex items-center gap-3 text-left hover:bg-blue-100 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-white border border-blue-100 flex items-center justify-center shrink-0">
            <Car className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-0.5">Active Vehicle</p>
            <p className="text-sm font-semibold text-foreground truncate">{getSessionTitle(recentSession)}</p>
            {recentSession.vin && (
              <p className="text-xs text-muted-foreground font-mono">VIN: {recentSession.vin}</p>
            )}
          </div>
          <p className="text-xs text-blue-600 font-medium shrink-0">Link to tools</p>
          <ChevronRight className="w-4 h-4 text-blue-400 shrink-0" />
        </button>
      )}

      {/* Tool cards */}
      <div className="space-y-4">
        {tools.map(tool => (
          <Card key={tool.id} className="border-border shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {/* Card header */}
              <div className="p-4 pb-3">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${tool.iconBg} flex items-center justify-center shrink-0`}>
                      <tool.icon className={`w-5 h-5 ${tool.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{tool.title}</p>
                      <p className="text-xs text-muted-foreground">{tool.subtitle}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0 mt-0.5">
                    Coming Soon
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{tool.description}</p>
              </div>

              {/* Feature list */}
              <div className="border-t border-border px-4 py-3 bg-secondary/30">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  What's included
                </p>
                <ul className="space-y-1.5">
                  {tool.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-foreground">
                      <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* VIN integration callout */}
      <div className="mt-5 p-4 rounded-2xl bg-secondary/50 border border-border">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-foreground mb-1">VIN-powered accuracy</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When these tools launch, they'll pull the VIN directly from your active negotiation or game plan — giving you rate quotes and insurance premiums for the exact vehicle you're considering, not a generic estimate.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
