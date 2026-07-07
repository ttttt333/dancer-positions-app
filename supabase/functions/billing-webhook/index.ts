/**
 * billing-webhook — Stripe Webhook（署名検証 + 課金状態同期）
 */

// @ts-ignore Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore Deno
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import {
  applyCheckoutSessionToUser,
  CORS_HEADERS,
  jsonResponse,
  requireWebhookConfig,
  retrieveSubscription,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  updateBillingBySubscriptionId,
} from "../_shared/billing.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const configErr = requireWebhookConfig();
  if (configErr) {
    return new Response(configErr, { status: 503 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    console.error("[billing-webhook] signature", e);
    return new Response(
      `Webhook Error: ${e instanceof Error ? e.message : "invalid"}`,
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id?.trim();
        if (!userId) {
          console.error(
            "[billing-webhook] checkout.session.completed missing client_reference_id",
            session.id
          );
          break;
        }
        await applyCheckoutSessionToUser(userId, {
          id: session.id,
          url: session.url,
          client_reference_id: session.client_reference_id,
          customer:
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id ?? null,
          subscription:
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id ?? null,
          payment_status: session.payment_status,
          status: session.status,
          mode: session.mode ?? "subscription",
        });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await updateBillingBySubscriptionId(sub.id, sub.status, false);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await updateBillingBySubscriptionId(sub.id, "canceled", true);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (subId) {
          const sub = await retrieveSubscription(subId);
          await updateBillingBySubscriptionId(sub.id, sub.status, false);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("[billing-webhook] handler", e);
    return jsonResponse({ error: "handler failed" }, 500);
  }

  return jsonResponse({ received: true });
});
