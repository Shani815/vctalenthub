import Stripe from 'stripe';
import { env } from './config/env';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia',
  typescript: true,
});

  export const STRIPE_PLANS = {
    student:{
    STUDENT_MONTHLY_PREMIUM: {
      id: process.env.STRIPE_STUDENT_PREMIUM_MONTHLY_PRICE_ID,
      name: 'Student Premium Monthly',
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