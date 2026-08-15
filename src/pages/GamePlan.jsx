import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Map, Plus, ChevronRight, Loader2, Target, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import GamePlanWizard from '@/components/gameplan/GamePlanWizard';

export default function GamePlan() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (e, planId) => {
    e.stopPropagation();
    setDeletingId(planId);
    await supabase.from('game_plans').delete().eq('id', planId);
    setPlans(prev => prev.filter(p => p.id !== planId));
    setDeletingId(null);
  };

  useEffect(() => { loadPlans(); }, [user]);

  const loadPlans = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('game_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setPlans(data);
    setLoading(false);
  };

  const statusColor = { planning: 'secondary', shopping: 'default', negotiating: 'default', complete: 'secondary' };
  const statusLabel = { planning: 'Planning', shopping: 'Shopping', negotiating: 'Negotiating', complete: 'Complete' };

  if (showWizard || editingPlan) {
    return (
      <GamePlanWizard
        plan={editingPlan}
        onClose={() => { setShowWizard(false); setEditingPlan(null); loadPlans(); }}
      />
    );
  }

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Game Plan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Plan your purchase before hitting the lot</p>
        </div>
        <Button onClick={() => setShowWizard(true)} size="sm" className="gap-1.5 rounded-xl">
          <Plus className="w-4 h-4" /> New Plan
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Target className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-foreground mb-2">No game plans yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Let AI help you figure out what to buy, where to shop, and how to finance it — before you set foot in a dealership.
          </p>
          <Button onClick={() => setShowWizard(true)} className="gap-2 rounded-xl">
            <Plus className="w-4 h-4" /> Create Your First Game Plan
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <Card
              key={plan.id}
              className="border-border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setEditingPlan(plan)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Map className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {plan.preferred_makes?.length ? plan.preferred_makes.join(', ') : 'Any Make'}{' '}
                      {plan.preferred_models?.length ? plan.preferred_models.join(', ') : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {plan.condition ? `${plan.condition === 'either' ? 'New or Used' : plan.condition.charAt(0).toUpperCase() + plan.condition.slice(1)}` : 'Any condition'}
                      {plan.budget_max ? ` · Up to $${plan.budget_max.toLocaleString()}` : ''}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(plan.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusColor[plan.status]}>{statusLabel[plan.status]}</Badge>
                  <button
                    onClick={(e) => handleDelete(e, plan.id)}
                    disabled={deletingId === plan.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    {deletingId === plan.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                  </button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
