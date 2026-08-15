import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, LogOut, Zap, Star, Building2, Crown, ChevronRight, Save } from 'lucide-react';

const TIERS = {
  free: { label: 'Free', color: 'secondary', icon: Zap, description: 'Limited sessions' },
  launchpad: { label: 'Launchpad', color: 'default', icon: Star, description: '30-Day Active Pass · $49.99' },
  showroom_pro: { label: 'Showroom Pro', color: 'default', icon: Crown, description: 'Annual Pass · $119.99/yr' },
  enterprise: { label: 'Enterprise', color: 'default', icon: Building2, description: 'B2B API Integration' },
};

export default function Profile() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ sessions: 0, saved: 0 });
  const [zipCode, setZipCode] = useState('');
  const [creditScore, setCreditScore] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      
      setZipCode(user.zip_code || '');
      setCreditScore(user.credit_score_range || '');
      
      // Load sessions for stats
      const { data: sessions } = await supabase
        .from('negotiation_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (sessions) {
        setStats({
          sessions: sessions.length,
          saved: sessions.reduce((acc, s) => acc + (s.amount_saved || 0), 0),
          completed: sessions.filter(s => s.status === 'completed').length,
        });
      }
    };
    load();
  }, [user]);

  const tier = TIERS[user?.subscription_tier || 'free'];
  const TierIcon = tier?.icon || Zap;

  const handleLogout = async () => {
    await logout(true);
    navigate('/login');
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    const { error } = await updateProfile({ 
      zip_code: zipCode, 
      credit_score_range: creditScore 
    });
    setSaving(false);
  };

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="text-2xl font-display font-bold text-foreground mb-5">Profile</h1>

      {/* User Card */}
      <Card className="border-border shadow-sm mb-4">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-foreground truncate">{user?.full_name || 'Loading...'}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <TierIcon className="w-3 h-3 text-primary" />
              <Badge variant={tier?.color} className="text-[10px]">{tier?.label}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Sessions', value: stats.sessions },
          { label: 'Completed', value: stats.completed || 0 },
          { label: 'Est. Saved', value: stats.saved > 0 ? `$${stats.saved.toLocaleString()}` : '$0' },
        ].map(({ label, value }) => (
          <Card key={label} className="border-border shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preferences */}
      <Card className="border-border shadow-sm mb-4">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm font-semibold">My Preferences</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ZIP Code</Label>
            <Input
              value={zipCode}
              onChange={e => setZipCode(e.target.value)}
              placeholder="e.g. 90210"
              className="rounded-xl"
              maxLength={10}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Credit Score Range</Label>
            <Select value={creditScore} onValueChange={setCreditScore}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select credit range..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent_750_plus">Excellent (750+)</SelectItem>
                <SelectItem value="good_700_749">Good (700–749)</SelectItem>
                <SelectItem value="fair_650_699">Fair (650–699)</SelectItem>
                <SelectItem value="building_below_650">Building (below 650)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSavePreferences} disabled={saving} className="w-full rounded-xl gap-2" size="sm">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card className="border-border shadow-sm mb-4">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm font-semibold">Subscription</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {Object.entries(TIERS).map(([key, t]) => {
            const TIcon = t.icon;
            const isCurrent = (user?.subscription_tier || 'free') === key;
            return (
              <div key={key} className={`flex items-center justify-between p-3 rounded-xl border ${isCurrent ? 'border-primary bg-blue-50' : 'border-border'}`}>
                <div className="flex items-center gap-3">
                  <TIcon className={`w-4 h-4 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className={`text-sm font-semibold ${isCurrent ? 'text-primary' : 'text-foreground'}`}>{t.label}</p>
                    <p className="text-[10px] text-muted-foreground">{t.description}</p>
                  </div>
                </div>
                {isCurrent ? (
                  <Badge variant="default" className="text-[10px]">Active</Badge>
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        variant="outline"
        onClick={handleLogout}
        className="w-full h-12 gap-2 text-destructive border-destructive/30 hover:bg-destructive/5 rounded-xl"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </Button>
    </div>
  );
}
