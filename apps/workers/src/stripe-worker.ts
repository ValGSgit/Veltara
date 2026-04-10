/**
 * stripe-worker — subscriptions, billing portal, webhooks, credits, marketplace
 *
 * Routes:
 * POST /api/billing/subscribe
 * POST /api/billing/portal
 * POST /api/billing/webhook
 * GET  /api/billing/status
 * POST /api/marketplace/list
 * GET  /api/marketplace/items
 * POST /api/marketplace/purchase
 * POST /api/credits/purchase
 * POST /api/credits/webhook
 */

import { z } from 'zod';
import { CREDIT_PACKS } from '@veltara/shared';
import { handleCors, withCors } from './utils/cors.js';
import { Errors, jsonResponse } from './utils/errors.js';
import { requireAuth } from './middleware/auth.js';
import { createSupabaseClient } from './utils/supabase.js';

interface Env {
  JWT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_CONNECT_CLIENT_ID: string;
  STRIPE_PRICE_PRO: string;
  STRIPE_PRICE_STUDIO: string;
  DEV_FAKE_STRIPE?: string;
}

function isFakeStripeMode(env: Env): boolean {
  const value = (env.DEV_FAKE_STRIPE ?? '').toLowerCase().trim();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

// ─── Stripe API Helpers ───────────────────────────────────────────────────────

async function stripeRequest(
  method: string,
  path: string,
  body: Record<string, unknown> | null,
  secretKey: string,
): Promise<unknown> {
  const url = `https://api.stripe.com/v1${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const encoded = body
    ? Object.entries(body)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : undefined;

  const res = await fetch(url, { method, headers, body: encoded });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: { message?: string } }).error?.message ?? 'Stripe error');
  return data;
}

async function verifyStripeWebhook(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const parts = signature.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts['t'];
  const sig = parts['v1'];
  if (!timestamp || !sig) return false;

  const payload = `${timestamp}.${body}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const computed = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const computedHex = Array.from(new Uint8Array(computed)).map((b) => b.toString(16).padStart(2, '0')).join('');

  return computedHex === sig;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response: Response;

      if (path === '/api/billing/subscribe' && request.method === 'POST') {
        response = await handleSubscribe(request, env);
      } else if (path === '/api/billing/portal' && request.method === 'POST') {
        response = await handlePortal(request, env);
      } else if (path === '/api/billing/webhook' && request.method === 'POST') {
        response = await handleBillingWebhook(request, env);
      } else if (path === '/api/billing/status' && request.method === 'GET') {
        response = await handleBillingStatus(request, env);
      } else if (path === '/api/marketplace/list' && request.method === 'POST') {
        response = await handleListItem(request, env);
      } else if (path === '/api/marketplace/items' && request.method === 'GET') {
        response = await handleGetMarketplaceItems(request, env);
      } else if (path === '/api/marketplace/purchase' && request.method === 'POST') {
        response = await handlePurchaseItem(request, env);
      } else if (path === '/api/credits/purchase' && request.method === 'POST') {
        response = await handleCreditPurchase(request, env);
      } else if (path === '/api/credits/webhook' && request.method === 'POST') {
        response = await handleCreditWebhook(request, env);
      } else {
        response = Errors.notFound();
      }

      return withCors(response, request);
    } catch (err) {
      console.error('stripe-worker error:', err);
      return withCors(Errors.internalError(), request);
    }
  },
};

// ─── POST /api/billing/subscribe ─────────────────────────────────────────────

const SubscribeSchema = z.object({
  plan: z.enum(['pro', 'studio']),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const body = await request.json().catch(() => null);
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest(parsed.error.message);

  const { plan, success_url, cancel_url } = parsed.data;

  if (isFakeStripeMode(env)) {
    return jsonResponse({
      checkout_url: `${success_url}${success_url.includes('?') ? '&' : '?'}dev_stripe=1&plan=${encodeURIComponent(plan)}`,
      mock: true,
      cancel_url,
    });
  }

  const priceId = plan === 'pro' ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_STUDIO;

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: user } = await db
    .from('users')
    .select('stripe_customer_id, email, username')
    .eq('id', result.claims.sub)
    .single() as { data: { stripe_customer_id: string | null; email: string; username: string } | null };

  if (!user) return Errors.notFound();

  let customerId = user.stripe_customer_id;

  if (!customerId) {
    const customer = await stripeRequest('POST', '/customers', {
      email: user.email,
      name: user.username,
      metadata: { user_id: result.claims.sub },
    }, env.STRIPE_SECRET_KEY) as { id: string };

    customerId = customer.id;
    await db.from('users').update({ stripe_customer_id: customerId }).eq('id', result.claims.sub);
  }

  const session = await stripeRequest('POST', '/checkout/sessions', {
    customer: customerId,
    mode: 'subscription',
    line_items: JSON.stringify([{ price: priceId, quantity: 1 }]),
    success_url,
    cancel_url,
    metadata: JSON.stringify({ user_id: result.claims.sub, plan }),
  }, env.STRIPE_SECRET_KEY) as { url: string };

  return jsonResponse({ checkout_url: session.url });
}

// ─── POST /api/billing/portal ─────────────────────────────────────────────────

async function handlePortal(request: Request, env: Env): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const body = await request.json().catch(() => ({})) as { return_url?: string };
  const returnUrl = body.return_url ?? 'https://veltara.gg';

  if (isFakeStripeMode(env)) {
    return jsonResponse({ portal_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}dev_billing_portal=1`, mock: true });
  }

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: user } = await db
    .from('users')
    .select('stripe_customer_id')
    .eq('id', result.claims.sub)
    .single() as { data: { stripe_customer_id: string | null } | null };

  if (!user?.stripe_customer_id) return Errors.badRequest('No Stripe customer found');

  const session = await stripeRequest('POST', '/billing_portal/sessions', {
    customer: user.stripe_customer_id,
    return_url: returnUrl,
  }, env.STRIPE_SECRET_KEY) as { url: string };

  return jsonResponse({ portal_url: session.url });
}

// ─── POST /api/billing/webhook ────────────────────────────────────────────────

async function handleBillingWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  const sig = request.headers.get('Stripe-Signature') ?? '';

  if (!isFakeStripeMode(env)) {
    const valid = await verifyStripeWebhook(body, sig, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) return Errors.badRequest('Invalid webhook signature');
  }

  const event = JSON.parse(body) as {
    type: string;
    data: { object: Record<string, unknown> };
  };

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const metadata = session['metadata'] as { user_id?: string; plan?: string } | null;
      if (metadata?.user_id && metadata?.plan) {
        await db.from('users').update({
          plan_tier: metadata.plan,
          stripe_subscription_id: session['subscription'] as string,
          subscription_status: 'active',
          subscription_period_end: null,
        }).eq('id', metadata.user_id);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const customerId = sub['customer'] as string;
      const status = sub['status'] as string;
      const periodEnd = new Date((sub['current_period_end'] as number) * 1000).toISOString();

      const planMap: Record<string, string> = {
        [env.STRIPE_PRICE_PRO]: 'pro',
        [env.STRIPE_PRICE_STUDIO]: 'studio',
      };
      const items = sub['items'] as { data: Array<{ price: { id: string } }> };
      const priceId = items?.data?.[0]?.price?.id ?? '';
      const newPlan = planMap[priceId] ?? 'free';

      await db.from('users').update({
        plan_tier: status === 'active' ? newPlan : 'free',
        subscription_status: status,
        subscription_period_end: periodEnd,
      }).eq('stripe_customer_id', customerId);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const customerId = sub['customer'] as string;
      await db.from('users').update({
        plan_tier: 'free',
        stripe_subscription_id: null,
        subscription_status: 'canceled',
      }).eq('stripe_customer_id', customerId);
      break;
    }
  }

  return jsonResponse({ received: true });
}

// ─── GET /api/billing/status ──────────────────────────────────────────────────

async function handleBillingStatus(request: Request, env: Env): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: user } = await db
    .from('users')
    .select('plan_tier, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end, credits')
    .eq('id', result.claims.sub)
    .single();

  if (!user) return Errors.notFound();
  return jsonResponse({ status: user });
}

// ─── POST /api/marketplace/list ───────────────────────────────────────────────

const ListItemSchema = z.object({
  item_id: z.string().uuid(),
  price_credits: z.number().int().min(1).max(100000),
});

async function handleListItem(request: Request, env: Env): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;
  if (result.claims.plan_tier === 'free') return Errors.forbidden('Studio plan required for marketplace');

  const body = await request.json().catch(() => null);
  const parsed = ListItemSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest(parsed.error.message);

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Verify user owns the item
  const { data: owned } = await db
    .from('inventory')
    .select('id')
    .eq('user_id', result.claims.sub)
    .eq('item_id', parsed.data.item_id)
    .maybeSingle();

  if (!owned) return Errors.forbidden('You do not own this item');

  const { data: listing, error } = await db
    .from('marketplace_listings')
    .insert({ seller_id: result.claims.sub, ...parsed.data })
    .select()
    .single();

  if (error || !listing) return Errors.internalError();

  return jsonResponse({ listing }, 201);
}

// ─── GET /api/marketplace/items ───────────────────────────────────────────────

async function handleGetMarketplaceItems(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const perPage = 24;
  const from = (page - 1) * perPage;

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  let query = db
    .from('marketplace_listings')
    .select('id, price_credits, created_at, seller_id, item_id, items!inner(id, name, type, rarity, asset_url)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(from, from + perPage - 1);

  if (type) query = query.eq('items.type', type);

  const { data } = await query;
  return jsonResponse({ items: data ?? [], page, has_more: (data?.length ?? 0) === perPage });
}

// ─── POST /api/marketplace/purchase ──────────────────────────────────────────

const PurchaseSchema = z.object({ listing_id: z.string().uuid() });

async function handlePurchaseItem(request: Request, env: Env): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const body = await request.json().catch(() => null);
  const parsed = PurchaseSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest(parsed.error.message);

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { data: listing } = await db
    .from('marketplace_listings')
    .select('id, seller_id, item_id, price_credits, is_active')
    .eq('id', parsed.data.listing_id)
    .single() as { data: { id: string; seller_id: string; item_id: string; price_credits: number; is_active: boolean } | null };

  if (!listing?.is_active) return Errors.notFound('Listing not found');
  if (listing.seller_id === result.claims.sub) return Errors.badRequest('Cannot buy your own listing');

  const { data: buyer } = await db
    .from('users')
    .select('credits')
    .eq('id', result.claims.sub)
    .single() as { data: { credits: number } | null };

  if (!buyer || buyer.credits < listing.price_credits) {
    return Errors.badRequest('Insufficient credits');
  }

  // Transfer credits: buyer -price, seller +80% (platform keeps 20%)
  const sellerShare = Math.floor(listing.price_credits * 0.8);

  await Promise.all([
    db.from('users').update({ credits: buyer.credits - listing.price_credits }).eq('id', result.claims.sub),
    db.from('users').update({ credits: (0 + sellerShare) }).eq('id', listing.seller_id),
    db.from('inventory').insert({ user_id: result.claims.sub, item_id: listing.item_id }),
    db.from('marketplace_listings').update({ is_active: false }).eq('id', listing.id),
  ]);

  return jsonResponse({ ok: true, credits_spent: listing.price_credits });
}

// ─── POST /api/credits/purchase ───────────────────────────────────────────────

const CreditPurchaseSchema = z.object({
  pack_index: z.number().int().min(0).max(2),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

async function handleCreditPurchase(request: Request, env: Env): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const body = await request.json().catch(() => null);
  const parsed = CreditPurchaseSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest(parsed.error.message);

  const pack = CREDIT_PACKS[parsed.data.pack_index];
  if (!pack) return Errors.badRequest('Invalid credit pack');

  if (isFakeStripeMode(env)) {
    return jsonResponse({
      checkout_url: `${parsed.data.success_url}${parsed.data.success_url.includes('?') ? '&' : '?'}dev_credits=1&credits=${pack.credits}`,
      mock: true,
    });
  }

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: user } = await db
    .from('users')
    .select('stripe_customer_id, email')
    .eq('id', result.claims.sub)
    .single() as { data: { stripe_customer_id: string | null; email: string } | null };

  const session = await stripeRequest('POST', '/checkout/sessions', {
    customer: user?.stripe_customer_id ?? undefined,
    mode: 'payment',
    line_items: JSON.stringify([{
      price_data: {
        currency: 'usd',
        product_data: { name: pack.label },
        unit_amount: pack.price_cents,
      },
      quantity: 1,
    }]),
    success_url: parsed.data.success_url,
    cancel_url: parsed.data.cancel_url,
    metadata: JSON.stringify({ user_id: result.claims.sub, credits: pack.credits, type: 'credits' }),
  }, env.STRIPE_SECRET_KEY) as { url: string };

  return jsonResponse({ checkout_url: session.url });
}

// ─── POST /api/credits/webhook ────────────────────────────────────────────────

async function handleCreditWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  const sig = request.headers.get('Stripe-Signature') ?? '';

  if (!isFakeStripeMode(env)) {
    const valid = await verifyStripeWebhook(body, sig, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) return Errors.badRequest('Invalid signature');
  }

  const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } };

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session['metadata'] as { user_id?: string; credits?: string; type?: string } | null;

    if (metadata?.type === 'credits' && metadata.user_id && metadata.credits) {
      const creditsToAdd = parseInt(metadata.credits);
      const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

      const { data: user } = await db
        .from('users')
        .select('credits')
        .eq('id', metadata.user_id)
        .single() as { data: { credits: number } | null };

      if (user) {
        await db.from('users').update({ credits: user.credits + creditsToAdd }).eq('id', metadata.user_id);
      }
    }
  }

  return jsonResponse({ received: true });
}
