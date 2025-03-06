import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production, look for .env file in the dist directory
const envPath = process.env.NODE_ENV === 'production'
  ? path.resolve(process.cwd(), '.env')
  : path.resolve(__dirname, '../../.env');

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn('Warning: .env file not found');
}

// List of required environment variables
const requiredEnvVars = [
  'SESSION_SECRET',
  'DATABASE_URL',
  'NEWS_API_KEY',
  'MAILMODO_API_KEY',
  'MAILMODO_BASE_URL',
  'MAILMODO_INTRO_CAMPAIGN_ID',
  'CLIENT_BASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISH_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PASSWORD_CHANGE_CAMPAIGN_ID',
  'WELCOME_CAMPAIGN_ID',
  'ACCOUNT_APPROVAL_CAMPAIGN_ID',
  'PROFILE_COMPLETION_REMINDER_CAMPAIGN_ID',
  'STUDENT_WEEKLY_SUMMARY_CAMPAIGN_ID',
  'BUSINESS_WEEKLY_SUMMARY_CAMPAIGN_ID',
  'REQUEST_CANDIDATE_INTERVIEW_CAMPAIGN_ID',
  'STRIPE_STUDENT_PREMIUM_MONTHLY_PRICE_ID',
  'STRIPE_STUDENT_PREMIUM_YEARLY_PRICE_ID',
  'STRIPE_BUSINESS_PREMIUM_MONTHLY_PRICE_ID',
  'STRIPE_BUSINESS_PREMIUM_YEARLY_PRICE_ID',
  'STRIPE_BUSINESS_PREMIUM_PRODUCT_ID',
  'STRIPE_STUDENT_PREMIUM_PRODUCT_ID',
] as const;

// Check for required environment variables
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});

// Export environment variables with types
export const env = {
  DATABASE_URL: process.env.DATABASE_URL as string,
  NEWS_API_KEY: process.env.NEWS_API_KEY as string,
  MAILMODO_API_KEY: process.env.MAILMODO_API_KEY as string,
  MAILMODO_BASE_URL: process.env.MAILMODO_BASE_URL as string,
  MAILMODO_INTRO_CAMPAIGN_ID: process.env.MAILMODO_INTRO_CAMPAIGN_ID as string,
  CLIENT_BASE_URL: process.env.CLIENT_BASE_URL as string,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY as string,
  STRIPE_PUBLISH_KEY: process.env.STRIPE_PUBLISH_KEY as string,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET as string,
  PASSWORD_CHANGE_CAMPAIGN_ID: process.env.PASSWORD_CHANGE_CAMPAIGN_ID as string,
  WELCOME_CAMPAIGN_ID: process.env.WELCOME_CAMPAIGN_ID as string,
  ACCOUNT_APPROVAL_CAMPAIGN_ID: process.env.ACCOUNT_APPROVAL_CAMPAIGN_ID as string,
  PROFILE_COMPLETION_REMINDER_CAMPAIGN_ID: process.env.PROFILE_COMPLETION_REMINDER_CAMPAIGN_ID as string,
  STUDENT_WEEKLY_SUMMARY_CAMPAIGN_ID: process.env.STUDENT_WEEKLY_SUMMARY_CAMPAIGN_ID as string,
  BUSINESS_WEEKLY_SUMMARY_CAMPAIGN_ID: process.env.BUSINESS_WEEKLY_SUMMARY_CAMPAIGN_ID as string,
  REQUEST_CANDIDATE_INTERVIEW_CAMPAIGN_ID: process.env.REQUEST_CANDIDATE_INTERVIEW_CAMPAIGN_ID as string,
  STRIPE_STUDENT_PREMIUM_MONTHLY_PRICE_ID: process.env.STRIPE_STUDENT_PREMIUM_MONTHLY_PRICE_ID as string,
  STRIPE_STUDENT_PREMIUM_YEARLY_PRICE_ID: process.env.STRIPE_STUDENT_PREMIUM_YEARLY_PRICE_ID as string,
  STRIPE_BUSINESS_PREMIUM_MONTHLY_PRICE_ID: process.env.STRIPE_BUSINESS_PREMIUM_MONTHLY_PRICE_ID as string,
  STRIPE_BUSINESS_PREMIUM_YEARLY_PRICE_ID: process.env.STRIPE_BUSINESS_PREMIUM_YEARLY_PRICE_ID as string,
  STRIPE_BUSINESS_PREMIUM_PRODUCT_ID: process.env.STRIPE_BUSINESS_PREMIUM_PRODUCT_ID as string,
  STRIPE_STUDENT_PREMIUM_PRODUCT_ID: process.env.STRIPE_STUDENT_PREMIUM_PRODUCT_ID as string,
};

export default env; 