import { eq } from "drizzle-orm";
import { subscriptions, users } from "@/db/schema";

import { db } from "@/db";
import { startOfWeek } from "date-fns";

export async function updateSubscriptionStatus(
    stripeSubscriptionId: string,
    status: string,
    currentPeriodStart?: Date,
    currentPeriodEnd?: Date
  ) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);
  
    if (!subscription) {
      throw new Error('Subscription not found');
    }
  
    const [updatedSubscription] = await db
      .update(subscriptions)
      .set({
        status,
        currentPeriodStart: currentPeriodStart || subscription.currentPeriodStart,
        currentPeriodEnd: currentPeriodEnd || subscription.currentPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();
  
    // Update user tier based on subscription status
    await db
      .update(users)
      .set({
        tier: status === 'active' ? 'premium' : 'free',
      })
      .where(eq(users.id, subscription.userId));
  
    return updatedSubscription;
  }
  
  export async function createSubscription(
    userId: number,
    stripeCustomerId: string,
    stripeSubscriptionId?: string,
    status: string = 'inactive'
  ) {
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        userId,
        stripeCustomerId,
        stripeSubscriptionId,
        status,
      })
      .returning();
  
    return subscription;
  }
  
  export async function getSubscriptionByCustomerId(stripeCustomerId: string) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
      .limit(1);
  
    return subscription;
  }
  
  export async function getSubscriptionByUserId(userId: number) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
  
    return subscription;
  } 