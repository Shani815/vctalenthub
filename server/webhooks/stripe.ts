import { Request, Response } from "express";
import { subscriptions, users } from "@/db/schema";

import Stripe from "stripe";
import { db } from "@/db";
import { env } from '@/server/config/env';
import { eq } from "drizzle-orm";

// Initialize Stripe with your secret key
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];

  if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
    console.error('Missing stripe signature or webhook secret');
    return res.status(400).send('Webhook Error: Missing signature');
  }

  try {
    // Verify the event
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );

    // Acknowledge receipt of the event
    res.json({ received: true });

    // Handle the event asynchronously
    handleWebhookEventAsync(event).catch((error) => {
      console.error('Async webhook processing error:', error);
    });
  } catch (err) {
    console.error('Stripe webhook error:', err instanceof Error ? err.message : 'Unknown error');
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

async function handleWebhookEventAsync(event: Stripe.Event) {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionCancellation(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_succeeded':
      await handleSuccessfulPayment(event.data.object as Stripe.Invoice);
      break;
    case 'invoice.payment_failed':
      await handleFailedPayment(event.data.object as Stripe.Invoice);
      break;
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const status = subscription.status;
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const priceId = subscription.items.data[0]?.price.id;

  try {
    // First, find the subscription record by customerId
    const [existingSubscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1);

    // Get userId from metadata or existing subscription
    let userId: number;
    if (existingSubscription) {
      userId = existingSubscription.userId;
      
      // Update subscription with status, dates, and priceId
      await db
        .update(subscriptions)
        .set({
          status: status,
          currentPeriodStart,
          currentPeriodEnd,
          updatedAt: new Date(),
          priceId: priceId,
        })
        .where(eq(subscriptions.stripeCustomerId, customerId));
    } else {
      // Get userId from subscription metadata or checkout session
      const metadataUserId = subscription.metadata?.userId;
      if (!metadataUserId) {
        // Try to get userId from the latest checkout session
        const session = await stripe.checkout.sessions.list({
          subscription: subscription.id,
          limit: 1,
        });
        
        if (session.data[0]?.metadata?.userId) {
          userId = parseInt(session.data[0].metadata.userId);
        } else {
          console.error('No userId found in subscription metadata or session:', subscription);
          throw new Error('No userId found in subscription metadata or session');
        }
      } else {
        userId = parseInt(metadataUserId);
      }

      // Verify the user exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        console.error('User not found for userId:', userId);
        throw new Error('User not found');
      }

      // Create new subscription record with all fields
      await db.insert(subscriptions).values({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        status: status,
        currentPeriodStart,
        currentPeriodEnd,
        priceId: priceId,
      });
    }

    // Always update user tier based on subscription status
    await db
      .update(users)
      .set({
        tier: status === 'active' ? 'premium' : 'free',
      })
      .where(eq(users.id, userId));

  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}

async function handleSubscriptionCancellation(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  try {
    // Update subscription status
    const [existingSubscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1);

    if (existingSubscription) {
      // Update subscription record
      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          currentPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeCustomerId, customerId));

      // Update user tier
      await db
        .update(users)
        .set({
          tier: 'free',
        })
        .where(eq(users.id, existingSubscription.userId));
    }
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    throw error;
  }
}

async function handleSuccessfulPayment(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return; // Only handle subscription invoices

  const customerId = invoice.customer as string;
  
  try {
    // Update subscription status to active
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1);

    if (subscription) {
      await db
        .update(subscriptions)
        .set({
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeCustomerId, customerId));

      // Update user tier to premium
      await db
        .update(users)
        .set({
          tier: 'premium',
        })
        .where(eq(users.id, subscription.userId));
    }
  } catch (error) {
    console.error('Error handling successful payment:', error);
    throw error;
  }
}

async function handleFailedPayment(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return; // Only handle subscription invoices

  const customerId = invoice.customer as string;
  
  try {
    // Update subscription status
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1);

    if (subscription) {
      await db
        .update(subscriptions)
        .set({
          status: 'inactive',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeCustomerId, customerId));

      // Update user tier to free
      await db
        .update(users)
        .set({
          tier: 'free',
        })
        .where(eq(users.id, subscription.userId));
    }
  } catch (error) {
    console.error('Error handling failed payment:', error);
    throw error;
  }
}