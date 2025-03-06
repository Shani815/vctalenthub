import { Request, Response } from "express";
import {
  STRIPE_PLANS_DETAILS,
  createCheckoutSession,
} from "@/server/config/stripe";

import { User } from "@/db/schema";
import { getSubscriptionByUserId } from "../helpers/stripe";

export const getStripePlans = async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    user.role === "student"
      ? res.json(STRIPE_PLANS_DETAILS.student)
      : res.json(STRIPE_PLANS_DETAILS.business);
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({ error: "Failed to fetch subscription plans" });
  }
};

export const initiateSubscription = async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send("Not logged in");
  }

  try {
    const { priceId } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: "Price ID is required" });
    }

    // Validate that the price ID matches one of our plans
    const validPriceIds = [
      process.env.STRIPE_STUDENT_PREMIUM_MONTHLY_PRICE_ID,
      process.env.STRIPE_STUDENT_PREMIUM_YEARLY_PRICE_ID,
      process.env.STRIPE_BUSINESS_PREMIUM_MONTHLY_PRICE_ID,
      process.env.STRIPE_BUSINESS_PREMIUM_YEARLY_PRICE_ID,
    ];

    if (!validPriceIds.includes(priceId)) {
      return res.status(400).json({ error: "Invalid price ID" });
    }

    const session = await createCheckoutSession(req.user.id, priceId);
    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
};

export const getUserSubscription = async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send("Not logged in");
  }

  try {
    const subscription = await getSubscriptionByUserId(req.user.id);
    res.json(subscription);
  } catch (error) {
    console.error("Error fetching subscription:", error);
    res.status(500).send("Error fetching subscription");
  }
};
