import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import {
  users,
  insertUserSchema,
  type User,
  superReferralCodes,
} from "@/db/schema";
import { db } from "@/db";
import { eq, sql, and, gte, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { trackUserActivity } from "./services/analytics";
import { networkConnections, jobApplications } from "@/db/schema";
import { sendEmail } from "./helpers/email-sender";

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      role: "student" | "venture_capitalist" | "startup" | "admin";
      tier: "free" | "premium";
      status: "pending" | "approved" | "rejected" | "banned";
      referralCode: string | null;
      hasCompletedOnboarding: boolean | null;
      createdAt: Date | null;
    }
  }
}

export function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "bluebox-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {},
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    sessionSettings.cookie = {
      secure: true,
    };
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }
        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect password." });
        }

        // Track login activity
        await trackUserActivity(user.id, "login", {
          timestamp: new Date(),
          success: true,
        });

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { referralCode, ...userData } = req.body;

      // First check if this is the first user
      const userCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(users);

      const isFirstUser = userCount[0].count === 0;
      let userStatus = "pending";
      let registrationMessage =
        "Thank you for registering! Your account is currently under review. We will notify you via email once your account is approved.";
      let finalReferralCode = nanoid(10); // Default referral code

      // Check for valid referral code unless it's the first user
      if (!isFirstUser && referralCode) {
        // First check if it's a super referral code
        const [superCode] = await db
          .select()
          .from(superReferralCodes)
          .where(
            and(
              eq(superReferralCodes.code, referralCode),
              eq(superReferralCodes.isActive, true)
            )
          )
          .limit(1);

        if (superCode) {
          userStatus = "approved";
          registrationMessage =
            "Account created successfully! You can now log in to your account.";
          finalReferralCode = nanoid(10); // Generate new code for approved users
        } else {
          // Check regular referral codes
          const [referrer] = await db
            .select()
            .from(users)
            .where(eq(users.referralCode, referralCode))
            .limit(1);

          if (!referrer) {
            // If referral code not found anywhere, use it as the user's referral code
            userStatus = "pending";
            finalReferralCode = referralCode;
            registrationMessage =
              "Thank you for registering! Your account requires approval. We will review your application and notify you via email once approved.";
          } else {
            userStatus = "approved";
            registrationMessage =
              "Account created successfully! You can now log in to your account.";
            finalReferralCode = nanoid(10); // Generate new code for approved users
          }
        }
      } else if (!isFirstUser) {
        // No referral code provided
        registrationMessage =
          "Thank you for registering! Your account requires approval. We will review your application and notify you via email once approved.";
      } else {
        // First user gets automatic approval
        userStatus = "approved";
        registrationMessage =
          "Welcome! Your account has been created successfully as the first user.";
      }

      const result = insertUserSchema.safeParse({
        ...userData,
        tier: "free",
      });

      if (!result.success) {
        return res
          .status(400)
          .send(
            "Invalid input: " +
              result.error.issues.map((i) => i.message).join(", ")
          );
      }

      const { username, password, email, role } = result.data;

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res
          .status(400)
          .send(
            "Username is already taken. Please choose a different username."
          );
      }

      const hashedPassword = await crypto.hash(password);

      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          email,
          role,
          tier: "free",
          referralCode: finalReferralCode,
          status: userStatus,
        })
        .returning();

      // If status is pending, don't log them in automatically
      if (userStatus === "pending") {
        // TODO: Send email notification about pending approval
        await sendEmail({
          to: email,
          campaignId: process.env.ACCOUNT_APPROVAL_CAMPAIGN_ID,
          campaignData: { first_name: username },
        });
        return res.json({ message: registrationMessage });
      }
      await sendEmail({
        to: email,
        campaignId: process.env.WELCOME_CAMPAIGN_ID,
        campaignData: {
          first_name: username,
          role_description:
            role === "student"
              ? "Unlock exclusive opportunities with VC firms and startups that don’t live on job boards. Get hired for internships, course credit projects, and full-time roles, and connect with founders and investors who can accelerate your career."
              : "Get direct access to top MBA talent for in-semester internships, summer roles, and full-time hires. Tap into high-growth startups, deal flow, and warm intros to key investors and operators, while leveraging the top alumni ecosystems.",
          profile_url: `${process.env.CLIENT_BASE_URL}/dashboard`,
        },
      });
      // For approved users, log them in automatically
      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: registrationMessage,
          user: newUser,
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res
        .status(500)
        .send("An error occurred during registration. Please try again later.");
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate(
      "local",
      async (err: any, user: Express.User, info: IVerifyOptions) => {
        if (err) {
          return next(err);
        }

        if (!user) {
          return res
            .status(400)
            .send(info.message ?? "Invalid username or password.");
        }

        // Check user status
        if (user.status === "pending") {
          return res
            .status(403)
            .send(
              "Your account is currently under review. You will receive an email notification once your account is approved."
            );
        }

        if (user.status === "rejected") {
          return res
            .status(403)
            .send(
              "Your account application has been declined. Please contact supportat Team@itsbluebox.com for more information."
            );
        }

        if (user.status === "banned") {
          return res
            .status(403)
            .send(
              "Your account has been banned. For any questions or account review, please contact Team@itsbluebox.com"
            );
        }

        req.logIn(user, (err) => {
          if (err) {
            return next(err);
          }

          return res.json({
            message: "Login successful",
            user,
          });
        });
      }
    )(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).send("Logout failed");
      }
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/user", async (req, res) => {
    if (req.isAuthenticated()) {
      try {
        // Get current week's connection requests
        const now = new Date();
        const userCreatedAt = new Date(req.user.createdAt ?? Date.now());
        const weeksSinceCreation = Math.floor(
          (now.getTime() - userCreatedAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        const currentWeekStart = new Date(
          userCreatedAt.getTime() + weeksSinceCreation * 7 * 24 * 60 * 60 * 1000
        );

        // Get this week's connection requests count
        const [{ count: weeklyRequestsCount }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(networkConnections)
          .where(
            and(
              eq(networkConnections.fromUserId, req.user.id),
              gte(networkConnections.createdAt, currentWeekStart)
            )
          );

        // Get total job applications count
        const [{ count: jobApplicationsCount }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(jobApplications)
          .where(eq(jobApplications.userId, req.user.id));

        // Calculate next reset date
        const nextWeekStart = new Date(
          currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000
        );
        const daysUntilReset = Math.ceil(
          (nextWeekStart.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );

        return res.json({
          ...req.user,
          temp: {
            weeklyConnectionRequests: weeklyRequestsCount,
            totalJobApplications: jobApplicationsCount,
            daysUntilWeeklyReset: daysUntilReset,
            weeklyResetDate: nextWeekStart,
          },
        });
      } catch (error) {
        console.error("Error fetching user data:", error);
        return res.status(500).json({
          message: "Failed to fetch complete user data",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    res.status(401).send("Not logged in");
  });

  // Add new endpoint for admin to manage referral codes
  app.post("/api/admin/referral-code", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).send("Unauthorized");
    }

    const { userId, referralCode, status } = req.body;

    try {
      const [user] = await db
        .update(users)
        .set({
          referralCode: referralCode || nanoid(10),
          status: status || "approved",
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();
      if (status === "approved") {
        await sendEmail({
          to: user.email,
          campaignId: process.env.WELCOME_CAMPAIGN_ID,
          campaignData: { first_name: user.username,
            role_description:
            user.role === "student"
              ? "Unlock exclusive opportunities with VC firms and startups that don’t live on job boards. Get hired for internships, course credit projects, and full-time roles, and connect with founders and investors who can accelerate your career."
              : "Get direct access to top MBA talent for in-semester internships, summer roles, and full-time hires. Tap into high-growth startups, deal flow, and warm intros to key investors and operators, while leveraging the top alumni ecosystems.",
          },
        });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating referral code:", error);
      res.status(500).send("Failed to update referral code");
    }
  });

  // Add endpoint to get all referral codes (admin only)
  app.get("/api/admin/referral-codes", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).send("Unauthorized");
    }

    try {
      const referralCodes = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          referralCode: users.referralCode,
          status: users.status,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      res.json(referralCodes);
    } catch (error) {
      console.error("Error fetching referral codes:", error);
      res.status(500).send("Failed to fetch referral codes");
    }
  });

  // Add endpoint to get all super referral codes (admin only)
  app.get("/api/admin/super-referral-codes", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).send("Unauthorized");
    }

    try {
      const codes = await db
        .select({
          id: superReferralCodes.id,
          code: superReferralCodes.code,
          isActive: superReferralCodes.isActive,
          createdAt: superReferralCodes.createdAt,
        })
        .from(superReferralCodes)
        .orderBy(desc(superReferralCodes.createdAt));

      res.json(codes);
    } catch (error) {
      console.error("Error fetching super referral codes:", error);
      res.status(500).send("Failed to fetch super referral codes");
    }
  });

  // Add endpoint to create super referral code (admin only)
  app.post("/api/admin/super-referral-codes", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).send("Unauthorized");
    }

    const { code } = req.body;

    if (!code) {
      return res.status(400).send("Code is required");
    }

    try {
      const [newCode] = await db
        .insert(superReferralCodes)
        .values({
          code,
          createdBy: req.user.id,
          isActive: true,
        })
        .returning();

      res.json(newCode);
    } catch (error) {
      console.error("Error creating super referral code:", error);
      res.status(500).send("Failed to create super referral code");
    }
  });

  // Add endpoint to update super referral code status (admin only)
  app.put("/api/admin/super-referral-codes/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).send("Unauthorized");
    }

    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).send("isActive must be a boolean");
    }

    try {
      const [updatedCode] = await db
        .update(superReferralCodes)
        .set({
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(superReferralCodes.id, parseInt(id)))
        .returning();

      res.json(updatedCode);
    } catch (error) {
      console.error("Error updating super referral code:", error);
      res.status(500).send("Failed to update super referral code");
    }
  });
}
