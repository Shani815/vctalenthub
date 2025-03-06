import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { relations } from "drizzle-orm";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "student",
  "venture_capitalist",
  "startup",
  "admin",
]);
export const userStatusEnum = pgEnum("user_status", [
  "pending",
  "approved",
  "rejected",
  "banned",
]);
export const userTierEnum = pgEnum("user_tier", ["free", "premium"]);
export const postTypeEnum = pgEnum("post_type", [
  "insight",
  "poll",
  "milestone",
  "announcement",
]);
export const connectionTypeEnum = pgEnum("connection_type", [
  "pending",
  "connected",
  "rejected",
]);
export const jobTypeEnum = pgEnum("job_type", [
  "full_time",
  "part_time",
  "internship",
  "contract",
]);
export const internshipTypeEnum = pgEnum("internship_type", [
  "paid",
  "unpaid",
  "not_applicable",
]);
export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "reviewed",
  "interviewing",
  "accepted",
  "rejected",
]);
export const messageStatusEnum = pgEnum("message_status", [
  "sent",
  "delivered",
  "read",
]);
export const achievementTypeEnum = pgEnum("achievement_type", [
  "connections",
  "posts",
  "engagement",
  "profile",
  "referrals",
]);
export const achievementStatusEnum = pgEnum("achievement_status", [
  "locked",
  "in_progress",
  "completed",
]);
export const highlightTypeEnum = pgEnum("highlight_type", [
  "pitch_decks",
  "financial_models",
  "investment_memos",
  "market_research_reports",
  "growth_strategy_documents",
  "consulting_projects",
  "case_competitions",
  "previously_built_companies",
  "media_features",
  "portfolio_wins",
  "fund_milestones",
  "exits_acquisitions",
  "cheque_sizes",
  "projects",
  "research_papers",
  "internships",
  "case_competitions",
  "certifications",
  "fundraising_announcements",
  "product_launches",
  "revenue_growth",
  "strategic_partnerships",
  "awards_recognition",
  "other",
]);

export const introStatusEnum = pgEnum("intro_status", [
  "pending",
  "accepted",
  "rejected",
]);

// Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").unique().notNull(),
  role: userRoleEnum("role").notNull().default("student"),
  tier: userTierEnum("tier").notNull().default("free"),
  status: userStatusEnum("status").notNull().default("pending"),
  referralCode: text("referral_code").unique(),
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  stripeCustomerId: text("stripe_customer_id").unique().notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  status: text("status").notNull().default("inactive"),
  priceId: text("price_id"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const intros = pgTable("intros", {
  id: serial("id").primaryKey(),
  targetId: integer("target_id")
    .references(() => users.id)
    .notNull(),
  requesterId: integer("requester_id")
    .references(() => users.id)
    .notNull(),
  status: introStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  name: text("name").notNull(),
  university: text("university"),
  graduationYear: text("graduation_year"),
  bio: text("bio"),
  skills: text("skills").array(),
  company: text("company"),
  companySize: text("company_size"),
  industry: text("industry").array(),
  location: text("location"),
  avatarUrl: text("avatar_url"),
  website: text("website"),
  linkedIn: text("linked_in"),
  mission: text("mission"),
  cultureValues: text("culture_values"),
  investmentThesis: text("investment_thesis"),
  portfolioSize: text("portfolio_size"),
  investmentRange: text("investment_range"),
  fundingStage: text("funding_stage"),
  major: text("major"),
  previousExperience: text("previous_experience"),
  careerGoals: text("career_goals"),
});

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    type: postTypeEnum("type").notNull().default("insight"),
    content: text("content").notNull(),
    pollOptions: text("poll_options").array(),
    isPinned: boolean("is_pinned").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => {
    return {
      userIdIdx: index("posts_user_id_idx").on(table.userId),
      pinnedIdx: index("posts_pinned_idx").on(table.isPinned),
      createdAtIdx: index("posts_created_at_idx").on(table.createdAt),
    };
  }
);

export const postLikes = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .references(() => posts.id)
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postComments = pgTable("post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .references(() => posts.id)
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const hashtags = pgTable("hashtags", {
  id: serial("id").primaryKey(),
  name: text("name").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postHashtags = pgTable("post_hashtags", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .references(() => posts.id)
    .notNull(),
  hashtagId: integer("hashtag_id")
    .references(() => hashtags.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const networkConnections = pgTable("network_connections", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id")
    .references(() => users.id)
    .notNull(),
  toUserId: integer("to_user_id")
    .references(() => users.id)
    .notNull(),
  type: connectionTypeEnum("type").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: achievementTypeEnum("type").notNull().default("connections"),
  requiredProgress: integer("required_progress").notNull(),
  rewardPoints: integer("reward_points").notNull(),
  iconName: text("icon_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  achievementId: integer("achievement_id")
    .references(() => achievements.id)
    .notNull(),
  currentProgress: integer("current_progress").notNull().default(0),
  status: achievementStatusEnum("status").notNull().default("locked"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  title: text("title").notNull(),
  description: text("content").notNull(),
  requirements: text("requirements").array(),
  location: text("location").notNull(),
  type: jobTypeEnum("type").notNull().default("full_time"),
  internshipType: internshipTypeEnum("internship_type")
    .notNull()
    .default("not_applicable"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  isRemote: boolean("is_remote").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobApplications = pgTable("job_applications", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .references(() => jobs.id)
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  status: applicationStatusEnum("status").notNull().default("pending"),
  resumeUrl: text("resume_url").notNull(),
  coverLetter: text("cover_letter"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Keep messages.status as text to match existing database
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    fromUserId: integer("from_user_id")
      .references(() => users.id)
      .notNull(),
    toUserId: integer("to_user_id")
      .references(() => users.id)
      .notNull(),
    content: text("content").notNull(),
    status: text("status").notNull().default("sent"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => {
    return {
      fromUserIdx: index("messages_from_user_idx").on(table.fromUserId),
      toUserIdx: index("messages_to_user_idx").on(table.toUserId),
      conversationIdx: index("messages_conversation_idx").on(
        table.fromUserId,
        table.toUserId
      ),
    };
  }
);

export const userBans = pgTable("user_bans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  reason: text("reason").notNull(),
  bannedBy: integer("banned_by")
    .references(() => users.id)
    .notNull(),
  bannedAt: timestamp("banned_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const platformAnalytics = pgTable("platform_analytics", {
  id: serial("id").primaryKey(),
  totalUsers: integer("total_users").notNull(),
  activeUsers: integer("active_users").notNull(),
  totalPosts: integer("total_posts").notNull(),
  totalConnections: integer("total_connections").notNull(),
  totalJobs: integer("total_jobs").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

export const helpRequests = pgTable("help_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reportedPosts = pgTable("reported_posts", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .references(() => posts.id)
    .notNull(),
  reportedBy: integer("reported_by")
    .references(() => users.id)
    .notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const highlights = pgTable("highlights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  type: highlightTypeEnum("type").notNull().default("pitch_deck"),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url"),
  url: text("url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userActivity = pgTable("user_activity", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  activityType: text("activity_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: text("metadata"),
});

export const superReferralCodes = pgTable("super_referral_codes", {
  id: serial("id").primaryKey(),
  code: text("code").unique().notNull(),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const userRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  posts: many(posts),
  likes: many(postLikes),
  comments: many(postComments),
  sentConnections: many(networkConnections, { relationName: "fromUser" }),
  receivedConnections: many(networkConnections, { relationName: "toUser" }),
  achievements: many(userAchievements),
  applications: many(jobApplications),
  jobs: many(jobs),
  sentMessages: many(messages, { relationName: "fromUser" }),
  receivedMessages: many(messages, { relationName: "toUser" }),
  bans: many(userBans),
  helpRequests: many(helpRequests),
  reportedPosts: many(reportedPosts, { relationName: "reporter" }),
  highlights: many(highlights),
  activities: many(userActivity),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  superReferralCodes: many(superReferralCodes),
}));

export const postRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  likes: many(postLikes),
  comments: many(postComments),
  hashtags: many(postHashtags),
}));

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const networkConnectionsRelations = relations(
  networkConnections,
  ({ one }) => ({
    fromUser: one(users, {
      fields: [networkConnections.fromUserId],
      references: [users.id],
    }),
    toUser: one(users, {
      fields: [networkConnections.toUserId],
      references: [users.id],
    }),
  })
);

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(posts, {
    fields: [postLikes.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postLikes.userId],
    references: [users.id],
  }),
}));

export const postCommentsRelations = relations(postComments, ({ one }) => ({
  post: one(posts, {
    fields: [postComments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [postComments.userId],
    references: [users.id],
  }),
}));

export const hashtagRelations = relations(hashtags, ({ many }) => ({
  posts: many(postHashtags),
}));

export const postHashtagsRelations = relations(postHashtags, ({ one }) => ({
  post: one(posts, {
    fields: [postHashtags.postId],
    references: [posts.id],
  }),
  hashtag: one(hashtags, {
    fields: [postHashtags.hashtagId],
    references: [hashtags.id],
  }),
}));

export const achievementRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
}));

export const userAchievementRelations = relations(
  userAchievements,
  ({ one }) => ({
    user: one(users, {
      fields: [userAchievements.userId],
      references: [users.id],
    }),
    achievement: one(achievements, {
      fields: [userAchievements.achievementId],
      references: [achievements.id],
    }),
  })
);

export const jobRelations = relations(jobs, ({ one, many }) => ({
  company: one(users, {
    fields: [jobs.userId],
    references: [users.id],
  }),
  applications: many(jobApplications),
}));

export const jobApplicationRelations = relations(
  jobApplications,
  ({ one }) => ({
    job: one(jobs, {
      fields: [jobApplications.jobId],
      references: [jobs.id],
    }),
    user: one(users, {
      fields: [jobApplications.userId],
      references: [users.id],
    }),
  })
);

export const messageRelations = relations(messages, ({ one }) => ({
  fromUser: one(users, {
    fields: [messages.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    fields: [messages.toUserId],
    references: [users.id],
  }),
}));

export const userBanRelations = relations(userBans, ({ one }) => ({
  user: one(users, {
    fields: [userBans.userId],
    references: [users.id],
  }),
  admin: one(users, {
    fields: [userBans.bannedBy],
    references: [users.id],
  }),
}));

export const helpRequestRelations = relations(helpRequests, ({ one }) => ({
  user: one(users, {
    fields: [helpRequests.userId],
    references: [users.id],
  }),
}));

export const reportedPostRelations = relations(reportedPosts, ({ one }) => ({
  post: one(posts, {
    fields: [reportedPosts.postId],
    references: [posts.id],
  }),
  reporter: one(users, {
    fields: [reportedPosts.reportedBy],
    references: [users.id],
  }),
}));

export const highlightRelations = relations(highlights, ({ one }) => ({
  user: one(users, {
    fields: [highlights.userId],
    references: [users.id],
  }),
}));

export const userActivityRelations = relations(userActivity, ({ one }) => ({
  user: one(users, {
    fields: [userActivity.userId],
    references: [users.id],
  }),
}));

export const superReferralCodeRelations = relations(superReferralCodes, ({ one }) => ({
  creator: one(users, {
    fields: [superReferralCodes.createdBy],
    references: [users.id],
  }),
}));

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Intro = typeof intros.$inferSelect;
export type InsertIntro = typeof intros.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PostLike = typeof postLikes.$inferSelect;
export type PostComment = typeof postComments.$inferSelect;
export type Hashtag = typeof hashtags.$inferSelect;
export type NetworkConnection = typeof networkConnections.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type UserBan = typeof userBans.$inferSelect;
export type PlatformAnalytics = typeof platformAnalytics.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type HelpRequest = typeof helpRequests.$inferSelect;
export type ReportedPost = typeof reportedPosts.$inferSelect;
export type Highlight = typeof highlights.$inferSelect;
export type NewHighlight = typeof highlights.$inferInsert;
export type UserActivity = typeof userActivity.$inferSelect;
export type NewUserActivity = typeof userActivity.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type SuperReferralCode = typeof superReferralCodes.$inferSelect;
export type NewSuperReferralCode = typeof superReferralCodes.$inferInsert;

// Validation schemas
export const insertUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["student", "venture_capitalist", "startup", "admin"]),
  tier: z.enum(["free", "premium"]).default("free"),
  status: z
    .enum(["pending", "approved", "rejected", "banned"])
    .default("pending"),
  referralCode: z.string().optional(),
});

export const selectUserSchema = createSelectSchema(users);
