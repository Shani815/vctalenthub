import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia',
  typescript: true,
});

export const STRIPE_PLANS = {
  PRO: "price_pro",
  ENTERPRISE: "price_enterprise",
} as const;

export const STRIPE_PLANS_DETAILS = {
  student:{
  STUDENT_MONTHLY_PREMIUM: {
    id: process.env.STRIPE_STUDENT_PREMIUM_MONTHLY_PRICE_ID,
    name: 'Student Premium Monthly',
    price: 10,
    description: 'Unlimited job applications, full network access, and BlueBox Intros',
    features: [
      'Unlimited job applications',
      'Full access to job listings',
      'Request BlueBox Intros',
      'Unlimited network connections',
      'Full profile access',
      'Priority support'
    ]
  },
  STUDENT_YEARLY_PREMIUM: {
    id: process.env.STRIPE_STUDENT_PREMIUM_YEARLY_PRICE_ID,
    name: 'Student Premium Yearly',
    price: 100,
    description: 'Full access to BlueBox Intros and network features',
    features: [
      'Request BlueBox Intros with any user',
      'Unlimited network connections',
      'Full profile access',
      'Advanced analytics',
      'Priority support',
      'Featured company profile'
    ]
  }
},business:{
  BUSINESS_MONTHLY_PREMIUM: {
    id: process.env.STRIPE_BUSINESS_PREMIUM_MONTHLY_PRICE_ID,
    name: 'Business Premium Monthly',
    price: 100,
    description: 'Unlimited job applications, full network access, and BlueBox Intros',
    features: [
      'Unlimited job applications',
      'Full access to job listings',
      'Request BlueBox Intros',
      'Unlimited network connections',
      'Full profile access',
      'Priority support'
    ]
  },
  BUSINESS_YEARLY_PREMIUM: {
    id: process.env.STRIPE_BUSINESS_PREMIUM_YEARLY_PRICE_ID,
    name: 'Business Premium Yearly',
    description: 'Full access to BlueBox Intros and network features',
    price: 1000,
    features: [
      'Request BlueBox Intros with any user',
      'Unlimited network connections',
      'Full profile access',
      'Advanced analytics',
      'Priority support',
      'Featured company profile'
    ]
  }
}
};

export type SubscriptionTier = 'free' | 'premium';
export type UserRole = 'student' | 'venture_capitalist' | 'startup' | 'admin';

export const TIER_LIMITS = {
  free: {
    student: {
      jobApplications: 2,
      weeklyConnections: 4,
      visibleJobs: 10,
      canRequestIntroWithStudent: false,
      canRequestIntroWithBusiness: false
    },
    venture_capitalist: {
      jobPosts: Infinity,
      weeklyConnections: 4,
      canRequestIntroWithStudent: true,
      canRequestIntroWithBusiness: false
    },
    startup: {
      jobPosts: Infinity,
      weeklyConnections: 4,
      canRequestIntroWithStudent: true,
      canRequestIntroWithBusiness: false
    }
  },
  premium: {
    student: {
      jobApplications: Infinity,
      weeklyConnections: Infinity,
      visibleJobs: Infinity,
      canRequestIntroWithStudent: true,
      canRequestIntroWithBusiness: true
    },
    venture_capitalist: {
      jobPosts: Infinity,
      weeklyConnections: Infinity,
      canRequestIntroWithStudent: true,
      canRequestIntroWithBusiness: true
    },
    startup: {
      jobPosts: Infinity,
      weeklyConnections: Infinity,
      canRequestIntroWithStudent: true,
      canRequestIntroWithBusiness: true
    }
  }
};

export async function createCustomer(email: string, name: string) {
  return stripe.customers.create({
    email,
    name,
  });
}

export async function createCheckoutSession(userId: number, priceId: string) {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
            
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.CLIENT_BASE_URL}/pricing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_BASE_URL}/pricing?stripe_error=true`,
    metadata: {
      userId: userId.toString(),
    },
  });

  return session;
}

export async function createPortalSession(customerId: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.CLIENT_BASE_URL}`,
  });

  return session;
}

export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.cancel(subscriptionId);
}

export async function getSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    webhookSecret
  );
}

export function getLimits(role: UserRole, tier: SubscriptionTier) {
  return TIER_LIMITS[tier][role];
} 