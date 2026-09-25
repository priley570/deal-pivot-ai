/**
 * Deal Pivot AI — Subscription Tier Configuration
 *
 * Tier structure:
 *   free         → "Starter" $1.99/mo   — Game Plan + research only (no live negotiations)
 *   launchpad    → "Launchpad" $49.99   — 30-day pass, full negotiation access
 *   showroom_pro → "Showroom Pro" $119.99/yr — Annual pass, full access
 *   enterprise   → Custom B2B pricing
 *
 * DB column: profiles.subscription_tier (TEXT)
 * DB values stay as-is ("free", "launchpad", etc.) — display labels live here only.
 */

import { Zap, Star, Crown, Building2 } from 'lucide-react';

export const TIER_CONFIG = {
  free: {
    label: 'Starter',
    price: '$1.99 / mo',
    badge: 'secondary',
    icon: Zap,
    description: 'Game Plan + research tools',
    canNegotiate: false,
    canGamePlan: true,
  },
  launchpad: {
    label: 'Launchpad',
    price: '$49.99 / 30 days',
    badge: 'default',
    icon: Star,
    description: 'Full negotiation access · 30-day pass',
    canNegotiate: true,
    canGamePlan: true,
  },
  showroom_pro: {
    label: 'Showroom Pro',
    price: '$119.99 / yr',
    badge: 'default',
    icon: Crown,
    description: 'Full access · Best value · Annual',
    canNegotiate: true,
    canGamePlan: true,
  },
  enterprise: {
    label: 'Enterprise',
    price: 'Custom',
    badge: 'default',
    icon: Building2,
    description: 'B2B bulk licenses + API access',
    canNegotiate: true,
    canGamePlan: true,
  },
};

/**
 * Returns true if the given subscription tier allows live negotiations.
 * Free (Starter) tier is limited to Game Plan + research only.
 */
export function canNegotiate(tier) {
  return TIER_CONFIG[tier]?.canNegotiate === true;
}

/**
 * Returns the display config for a given tier key.
 * Falls back to free/Starter if the key is unrecognized.
 */
export function getTierConfig(tier) {
  return TIER_CONFIG[tier] ?? TIER_CONFIG.free;
}
