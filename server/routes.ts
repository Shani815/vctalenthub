import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@/db";
import {
  posts,
  profiles,
  users,
  postLikes,
  postComments,
  hashtags,
  postHashtags,
  networkConnections,
  userAchievements,
  jobs,
  jobApplications,
  messages,
  userBans,
  intros,
  helpRequests,
  highlights,
  subscriptions,
  achievements,
  userActivity,
  reportedPosts,
} from "@/db/schema";
import {
  eq,
  and,
  desc,
  asc,
  or,
  sql,
  gte,
  lte,
  ilike,
  notInArray,
  ne,
  exists,
} from "drizzle-orm";
import type { User } from "@/db/schema";
import {
  initializeAchievements,
  initializeUserAchievements,
  updateAchievementProgress,
} from "./services/achievements";
import multer from "multer";
import path from "path";
import { randomBytes } from "crypto";
import express from "express";
import { getTopStartupNews, type NewsArticle } from "./services/news";
import { scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import {
  createIntroRequest,
  getPendingIntros,
  respondToIntroRequest,
} from "./controllers/intros";
import { sendEmail } from "./helpers/email-sender";
import { createStudentProfile } from "./controllers/profiles";
import { getUsers } from "./controllers/admin/users";
import {
  createHighlight,
  deleteHighlight,
  getHighlights,
} from "./controllers/highlights";
import { getAnalytics } from "./services/analytics";
import {
  getStripePlans,
  getUserSubscription,
  initiateSubscription,
} from "./controllers/stripe";
import { handleStripeWebhook } from "./webhooks/stripe";
import { stripe } from "./stripe";
import { normalizeField } from "./helpers";

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

export function registerRoutes(app: Express): Server {
  // Stripe webhook endpoint - must be before other routes
  app.post("/api/stripe/webhook", handleStripeWebhook);

  // Admin routes
  app.get("/api/admin/analyticss", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    try {
      // Get counts
      const [userCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users);

      const [postCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(posts);

      const [connectionCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(networkConnections);

      const [jobCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(jobs);

      // Get pending users
      const pendingUsers = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .leftJoin(profiles, eq(users.id, profiles.userId))
        .where(eq(users.status, "pending"));

      // Get banned users
      const bannedUsers = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          banReason: userBans.reason,
        })
        .from(users)
        .leftJoin(profiles, eq(users.id, profiles.userId))
        .leftJoin(userBans, eq(users.id, userBans.userId))
        .where(eq(users.status, "banned"));
      // Get help requests
      const helpRequestsData = await db
        .select({
          id: helpRequests.id,
          userId: helpRequests.userId,
          username: users.username,
          subject: helpRequests.title,
          message: helpRequests.description,
          status: helpRequests.status,
          createdAt: helpRequests.createdAt,
        })
        .from(helpRequests)
        .innerJoin(users, eq(helpRequests.userId, users.id))
        .orderBy(desc(helpRequests.createdAt));

      res.json({
        counts: {
          totalUsers: userCount.count,
          totalPosts: postCount.count,
          totalConnections: connectionCount.count,
          totalJobs: jobCount.count,
          pendingApprovals: pendingUsers.length,
          reportedPosts: 0, // Will be implemented later
          helpRequests: helpRequestsData.length,
        },
        pendingUsers,
        bannedUsers,
        helpRequestsData,
      });
    } catch (error) {
      console.error("Error fetching admin analytics:", error);
      res.status(500).json({
        message: "Failed to fetch admin analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Analytics endpoint
  app.get("/api/admin/analytics", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== "admin") {
        return res.status(403).send("Access denied");
      }

      const timeRange = req.query.timeRange || "30"; // Default to 30 days
      const analytics = await getAnalytics(parseInt(timeRange as string));

      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).send("Error fetching analytics data");
    }
  });

  // Add user action endpoints
  app.post("/api/admin/users/:userId/:action", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const { userId, action } = req.params;
    const id = parseInt(userId);

    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    try {
      switch (action) {
        case "approve":
          await db
            .update(users)
            .set({ status: "approved" })
            .where(eq(users.id, id));
            const [user] = await db.select().from(users).where(eq(users.id, id));
            await sendEmail({
              to: user.email,
              campaignId: process.env.WELCOME_CAMPAIGN_ID,
              campaignData: { first_name: user.username,
                role_description:
                user.role === "student"
                  ? "Unlock exclusive opportunities with VC firms and startups that don't live on job boards. Get hired for internships, course credit projects, and full-time roles, and connect with founders and investors who can accelerate your career."
                  : "Get direct access to top MBA talent for in-semester internships, summer roles, and full-time hires. Tap into high-growth startups, deal flow, and warm intros to key investors and operators, while leveraging the top alumni ecosystems.",
              },
            });
          break;

        case "reject":
          await db
            .update(users)
            .set({ status: "rejected" })
            .where(eq(users.id, id));
          await db.delete(users).where(eq(users.id, id));
          break;

        case "ban":
          await db
            .update(users)
            .set({ status: "banned" })
            .where(eq(users.id, id));

          // Add ban record if reason provided
          if (req.body.reason) {
            await db.insert(userBans).values({
              userId: id,
              reason: req.body.reason,
              bannedBy: (req.user as User).id,
            });
          }
          break;

        case "unban":
          await db
            .update(users)
            .set({ status: "approved" })
            .where(eq(users.id, id));

          // Remove ban records
          await db.delete(userBans).where(eq(userBans.userId, id));
          break;
        case "tier":
          const { tier } = req.body;
          if (!tier || !["free", "premium"].includes(tier)) {
            return res.status(400).json({
              message: "Invalid tier value. Must be 'free' or 'premium'",
            });
          }

          await db
            .update(users)
            .set({ tier: tier as "free" | "premium" })
            .where(eq(users.id, id));
          break;

        default:
          return res.status(400).json({ message: "Invalid action" });
      }

      res.json({ success: true, message: `User ${action}ed successfully` });
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      res.status(500).json({
        message: `Failed to ${action} user`,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/admin/users", getUsers);
  // First setup authentication
  setupAuth(app);

  // Initialize achievements system (if not already initialized)
  initializeAchievements().catch(console.error);

  // Event handler for after successful registration
  app.post("/api/post-registration", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      await initializeUserAchievements((req.user as User).id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to initialize achievements:", error);
      res.status(500).json({
        message: "Failed to initialize achievements",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Add password change route after the user routes
  app.post("/api/user/change-password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Not logged in",
        success: false,
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
        success: false,
      });
    }

    try {
      // Get the user's current password hash from the database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, (req.user as User).id))
        .limit(1);

      if (!user) {
        return res.status(404).json({
          message: "User not found",
          success: false,
        });
      }

      // Verify current password
      const isMatch = await crypto.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          message: "Current password is incorrect",
          success: false,
        });
      }

      // Hash the new password
      const hashedPassword = await crypto.hash(newPassword);

      // Update the password in the database
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, (req.user as User).id));

      // fetcjh user profile info and send email
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, (req.user as User).id));
      await sendEmail({
        to: (req.user as User).email,
        campaignId: process.env.PASSWORD_CHANGE_CAMPAIGN_ID,
        campaignData: {
          first_name: profile?.firstName || (req.user as User).username,
        },
      });

      return res.json({
        message: "Password changed successfully",
        success: true,
      });
    } catch (error) {
      console.error("Error changing password:", error);
      return res.status(500).json({
        message: "Failed to change password",
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      });
    }
  });

  // Social Feed Routes
  app.get("/api/posts", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const feedPosts = await db.query.posts.findMany({
      orderBy: desc(posts.createdAt),
      with: {
        author: {
          with: {
            profile: true,
          },
        },
        likes: true,
        comments: {
          with: {
            author: {
              with: {
                profile: true,
              },
            },
          },
          orderBy: desc(postComments.createdAt),
        },
      },
    });

    res.json(feedPosts);
  });

  // Add the DELETE posts endpoint just before the network routes
  app.delete("/api/posts/:postId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Not logged in",
        success: false,
      });
    }

    const postId = parseInt(req.params.postId);
    if (isNaN(postId)) {
      return res.status(400).json({
        message: "Invalid post ID",
        success: false,
      });
    }

    try {
      // First check if the post exists and belongs to the user
      const [post] = await db
        .select()
        .from(posts)
        .where(
          and(
            eq(posts.id, postId),
            (req.user as User).role !== "admin"
              ? eq(posts.userId, (req.user as User).id)
              : sql`true`
          )
        )
        .limit(1);

      if (!post) {
        return res.status(404).json({
          message: "Post not found or you don't have permission to delete it",
          success: false,
        });
      }

      // Delete all comments for this post first
      await db.delete(postComments).where(eq(postComments.postId, postId));

      // Delete all likes for this post
      await db.delete(postLikes).where(eq(postLikes.postId, postId));

      // Delete all hashtag associations
      await db.delete(postHashtags).where(eq(postHashtags.postId, postId));

      // Finally delete the post
      await db.delete(posts).where(eq(posts.id, postId));

      return res.json({
        success: true,
        message: "Post deleted successfully",
        postId: postId,
      });
    } catch (error) {
      console.error("Error deleting post:", error);
      return res.status(500).json({
        message: "Failed to delete post",
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      });
    }
  });

  app.post("/api/posts", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const {
      content,
      type,
      pollOptions,
      hashtags: hashtagNames,
      isPinned = false,
    } = req.body;
    const pinnedPost = (req.user as User).role === "admin" ? isPinned : false;

    const result = await db.transaction(async (tx) => {
      const [newPost] = await tx
        .insert(posts)
        .values({
          userId: (req.user as User).id,
          content,
          type,
          pollOptions: pollOptions || [],
          isPinned: pinnedPost,
        })
        .returning();

      if (hashtagNames && hashtagNames.length > 0) {
        for (const name of hashtagNames) {
          const [hashtag] = await tx
            .insert(hashtags)
            .values({ name })
            .onConflictDoUpdate({
              target: hashtags.name,
              set: { name },
            })
            .returning();

          await tx.insert(postHashtags).values({
            postId: newPost.id,
            hashtagId: hashtag.id,
          });
        }
      }

      return newPost;
    });

    res.json(result);
  });

  app.post("/api/posts/:id/pin", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Access denied");
    }

    const { id } = req.params;
    const { isPinned } = req.body;

    try {
      const [updatedPost] = await db
        .update(posts)
        .set({ isPinned })
        .where(eq(posts.id, parseInt(id)))
        .returning();

      res.json(updatedPost);
    } catch (error) {
      console.error("Error pinning post:", error);
      res.status(500).json({ message: "Failed to pin post" });
    }
  });

  app.post("/api/posts/:postId/like", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const postId = parseInt(req.params.postId);
    const userId = (req.user as User).id;

    const [existingLike] = await db
      .select()
      .from(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
      .limit(1);

    if (existingLike) {
      await db.delete(postLikes).where(eq(postLikes.id, existingLike.id));

      res.json({ message: "Post unliked successfully" });
    } else {
      const [newLike] = await db
        .insert(postLikes)
        .values({ postId, userId })
        .returning();

      res.json(newLike);
    }
  });

  app.post("/api/posts/:postId/comments", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const { content } = req.body;
    const postId = parseInt(req.params.postId);

    const [comment] = await db
      .insert(postComments)
      .values({
        postId,
        userId: (req.user as User).id,
        content,
      })
      .returning();

    res.json(comment);
  });

  app.delete("/api/posts/:postId/comments/:commentId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Not logged in",
        success: false,
      });
    }

    const postId = parseInt(req.params.postId);
    const commentId = parseInt(req.params.commentId);

    if (isNaN(postId) || isNaN(commentId)) {
      return res.status(400).json({
        message: "Invalid post or comment ID",
        success: false,
      });
    }

    try {
      // First verify the comment exists and belongs to the user
      const [comment] = await db
        .select()
        .from(postComments)
        .where(
          and(
            eq(postComments.id, commentId),
            eq(postComments.postId, postId),
            (req.user as User).role !== "admin"
              ? eq(postComments.userId, (req.user as User).id)
              : sql`true`
          )
        )
        .limit(1);

      if (!comment) {
        return res.status(404).json({
          message:
            "Comment not found or you don't have permission to delete it",
          success: false,
        });
      }

      // Delete the comment
      await db.delete(postComments).where(eq(postComments.id, commentId));

      // Return success response
      return res.json({
        success: true,
        message: "Comment deleted successfully",
        commentId: commentId,
      });
    } catch (error) {
      console.error("Error deleting comment:", error);
      return res.status(500).json({
        message: "Failed to delete comment",
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      });
    }
  });

  app.post("/api/posts/:postId/comments/:commentId/like", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Not logged in",
        success: false,
      });
    }

    const postId = parseInt(req.params.postId);
    const commentId = parseInt(req.params.commentId);
    const userId = (req.user as User).id;

    if (isNaN(postId) || isNaN(commentId)) {
      return res.status(400).json({
        message: "Invalid post or comment ID",
        success: false,
      });
    }

    try {
      // First verify the comment exists and belongs to the post
      const [comment] = await db
        .select()
        .from(postComments)
        .where(
          and(eq(postComments.id, commentId), eq(postComments.postId, postId))
        )
        .limit(1);

      if (!comment) {
        return res.status(404).json({
          message: "Comment not found",
          success: false,
        });
      }

      // Check if user has already liked the comment
      const [existingLike] = await db
        .select()
        .from(postLikes)
        .where(
          and(
            eq(postLikes.userId, userId),
            eq(postLikes.postId, postId),
            eq(postLikes.commentId, commentId)
          )
        )
        .limit(1);

      if (existingLike) {
        // Unlike the comment
        await db.delete(postLikes).where(eq(postLikes.id, existingLike.id));

        return res.json({
          success: true,
          message: "Comment unliked successfully",
          action: "unliked",
        });
      }

      // Like the comment
      const [newLike] = await db
        .insert(postLikes)
        .values({
          userId: userId,
          postId: postId,
          commentId: commentId,
        })
        .returning();

      return res.json({
        success: true,
        message: "Comment liked successfully",
        like: newLike,
        action: "liked",
      });
    } catch (error) {
      console.error("Error liking/unliking comment:", error);
      return res.status(500).json({
        message: "Failed to like/unlike comment",
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      });
    }
  });

  app.get("/api/hashtags/trending", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const trendingHashtags = await db
      .select({
        id: hashtags.id,
        name: hashtags.name,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(hashtags)
      .innerJoin(postHashtags, eq(hashtags.id, postHashtags.hashtagId))
      .innerJoin(posts, eq(postHashtags.postId, posts.id))
      .where(sql`${posts.createdAt} > now() - interval '7 days'`)
      .groupBy(hashtags.id)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    res.json(trendingHashtags);
  });

  // Profile routes
  app.get("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, (req.user as User).id))
        .limit(1);

      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({
        message: "Failed to fetch profile",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Configure multer for profile image uploads
  const storageProfile = multer.diskStorage({
    destination: "./uploads/avatars",
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${randomBytes(6).toString("hex")}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  });

  const uploadProfile = multer({
    storage: storageProfile,
    fileFilter: (req, file, cb) => {
      const allowedTypes = [".jpg", ".jpeg", ".png", ".gif"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(
          new Error(
            "Invalid file type. Only JPG, PNG and GIF images are allowed."
          )
        );
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
  });

  const storageHighlight = multer.diskStorage({
    destination: "./uploads/documents",
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${randomBytes(6).toString("hex")}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  });

  const uploadHighlight = multer({
    storage: storageHighlight,
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        ".pdf",
        ".doc",
        ".docx",
        ".ppt",
        ".pptx",
        ".xls",
        ".xlsx",
      ];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(
          new Error(
            "Invalid file type. Only PDF, Word, PowerPoint, and Excel documents are allowed."
          )
        );
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
  });

  // Profile routes with image upload support
  app.post("/api/profile", uploadProfile.single("avatar"), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      const [existing] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, (req.user as User).id))
        .limit(1);

      // Parse skills from form data
      let skills: string[] = [];
      if (req.body.skills) {
        // Handle both array and string formats
        if (Array.isArray(req.body.skills)) {
          skills = req.body.skills.map((s) => {
            if (typeof s === "string") {
              // Try to parse if it's a JSON string
              try {
                let parsed = s;
                while (typeof parsed === "string") {
                  try {
                    parsed = JSON.parse(parsed);
                  } catch {
                    break;
                  }
                }
                return typeof parsed === "string" ? parsed : String(parsed);
              } catch {
                return s;
              }
            }
            return String(s);
          });
        } else if (typeof req.body.skills === "string") {
          try {
            // Try to parse if it's a JSON string
            let parsed = req.body.skills;
            while (typeof parsed === "string") {
              try {
                parsed = JSON.parse(parsed);
              } catch {
                break;
              }
            }
            skills = Array.isArray(parsed)
              ? parsed.map(String)
              : [String(parsed)];
          } catch {
            // If parsing fails, split by comma
            skills = req.body.skills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
        }
      }

      const profileData = {
        ...req.body,
        skills: skills,
        avatarUrl: req.file
          ? `/uploads/avatars/${req.file.filename}`
          : existing?.avatarUrl,
      };

      if (existing) {
        const [updated] = await db
          .update(profiles)
          .set(profileData)
          .where(eq(profiles.id, existing.id))
          .returning();
        return res.json(updated);
      }

      const [profile] = await db
        .insert(profiles)
        .values({ ...profileData, userId: (req.user as User).id })
        .returning();

      res.json(profile);
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({
        message: "Failed to update profile",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Network routes
  app.get("/api/network", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, (req.user as User).id))
        .limit(1);

      // Get all users with their profiles
      const networkUsers = await db.query.users.findMany({
        where: eq(users.status, 'approved'), // Exclude banned users
        with: {
          profile: true,
        },
      });

      // Get all connections related to the current user
      const connections = await db
        .select()
        .from(networkConnections)
        .where(
          or(
            eq(networkConnections.fromUserId, (req.user as User).id),
            eq(networkConnections.toUserId, (req.user as User).id)
          )
        );

      // Add connection status for each user except the current user
      const usersWithConnectionStatus = networkUsers
        .filter((user) => user.id !== (req.user as User).id)
        .map((user) => {
          const connection = connections.find(
            (conn) =>
              (conn.fromUserId === user.id &&
                conn.toUserId === (req.user as User).id) ||
              (conn.fromUserId === (req.user as User).id &&
                conn.toUserId === user.id)
          );

          return {
            ...user,
            connectionStatus: connection ? connection.type : "not_connected",
          };
        });

      // Include all users in the response for the network map
      const allUsers = networkUsers.map((user) => ({
        ...user,
        connectionStatus:
          user.id === (req.user as User).id
            ? "self"
            : usersWithConnectionStatus.find((u) => u.id === user.id)
                ?.connectionStatus || "not_connected",
      }));

      res.json({
        users: usersWithConnectionStatus,
        allUsers,
        connections,
      });
    } catch (error) {
      console.error("Error fetching network data:", error);
      res.status(500).json({
        message: "Failed to fetch network data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Weekly Networking Digest renamed to Roundup
  app.get("/api/roundup", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Fetch recent posts
      const recentPosts = await db.query.posts.findMany({
        where: gte(posts.createdAt, weekAgo),
        orderBy: desc(posts.createdAt),
        with: {
          author: {
            with: {
              profile: true,
            },
          },
        },
        limit: 50,
      });

      // Fetch top startup news
      const headlines = await getTopStartupNews();

      // Return response with top headlines section
      res.json({
        headlines,
        insights: [
          "Your network has grown by 25% in the last month",
          "Most active discussions are around AI and Machine Learning",
          "Several connections recently changed jobs in your industry",
        ],
        suggestedTopics: [
          "Recent industry trends",
          "Professional development",
          "Networking strategies",
          "Career growth",
          "Technical skills",
        ],
      });
    } catch (error) {
      console.error("Roundup generation error:", error);
      res.status(500).json({
        message: "Failed to generate roundup",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Achievement routes
  app.get("/api/achievements", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      const userAchievementsList = await db.query.userAchievements.findMany({
        where: eq(userAchievements.userId, (req.user as User).id),
        with: {
          achievement: true,
        },
      });

      res.json(userAchievementsList);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({
        message: "Failed to fetch achievements",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Update achievement progress after various actions
  app.post("/api/network", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      const networkUsers = await db.query.users.findMany({
        with: {
          profile: true,
        },
      });

      const connections = await db
        .select()
        .from(networkConnections)
        .where(
          or(
            eq(networkConnections.fromUserId, (req.user as User).id),
            eq(networkConnections.toUserId, (req.user as User).id)
          )
        );

      const connectionCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(networkConnections)
        .where(
          or(
            eq(networkConnections.fromUserId, (req.user as User).id),
            eq(networkConnections.toUserId, (req.user as User).id)
          )
        );

      await updateAchievementProgress(
        (req.user as User).id,
        "connections",
        connectionCount[0].count
      );

      res.json({ users: networkUsers, connections });
    } catch (error) {
      next(error);
    }
  });

  // Job Board Routes
  app.get("/api/jobs", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      const { type, internshipType, salaryMin, salaryMax, isRemote, search } =
        req.query;

      let conditions = [];

      // Add role-based filtering
      if (["startup", "venture_capitalist"].includes((req.user as User).role)) {
        conditions.push(eq(jobs.userId, (req.user as User).id));
      }

      // Only add type filter if a specific type is requested
      if (type && type !== "all") {
        conditions.push(eq(jobs.type, type as string));
      }

      // Only add internship type filter if a specific type is requested
      if (internshipType && internshipType !== "all") {
        conditions.push(eq(jobs.internshipType, internshipType as string));
      }

      // Add salary filters if provided
      if (salaryMin) {
        conditions.push(gte(jobs.salaryMin, parseInt(salaryMin as string)));
      }

      if (salaryMax) {
        conditions.push(lte(jobs.salaryMax, parseInt(salaryMax as string)));
      }

      // Add remote filter if true
      if (isRemote === "true") {
        conditions.push(eq(jobs.isRemote, true));
      }

      // Add search filter if provided
      if (search) {
        conditions.push(
          or(
            ilike(jobs.title, `%${search}%`),
            ilike(jobs.description, `%${search}%`)
          )
        );
      }

      // Build the final query
      const query = conditions.length > 0 ? and(...conditions) : undefined;

      const jobListings = await db.query.jobs.findMany({
        where: query,
        with: {
          company: {
            with: {
              profile: true,
            },
          },
        },
        orderBy: desc(jobs.createdAt),
      });

      res.json(jobListings);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({
        message: "Failed to fetch jobs",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Add job posting endpoint
  app.post("/api/jobs", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    // if ((req.user as User).role !== 'company') {
    //   return res.status(403).send("Only companies can post jobs");
    // }

    try {
      const {
        title,
        description,
        requirements,
        location,
        type,
        internshipType = "not_applicable",
        salaryMin,
        salaryMax,
        isRemote = false,
      } = req.body;

      const [job] = await db
        .insert(jobs)
        .values({
          userId: (req.user as User).id,
          title,
          description,
          requirements: Array.isArray(requirements)
            ? requirements
            : requirements.split("\n").filter(Boolean),
          location,
          type,
          internshipType,
          salaryMin: salaryMin ? parseInt(salaryMin) : 0,
          salaryMax: salaryMax ? parseInt(salaryMax) : 0,
          isRemote,
        })
        .returning();

      // Fetch the created job with company information
      const jobWithCompany = await db.query.jobs.findFirst({
        where: eq(jobs.id, job.id),
        with: {
          company: {
            with: {
              profile: true,
            },
          },
        },
      });

      res.json(jobWithCompany);
    } catch (error) {
      console.error("Error creating job:", error);
      res.status(500).json({
        message: "Failed to create job",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Update job endpoint
  app.put("/api/jobs/:jobId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) {
      return res.status(400).send("Invalid job ID");
    }

    try {
      // Check if job exists and belongs to the user
      const [existingJob] = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.userId, (req.user as User).id)))
        .limit(1);

      if (!existingJob) {
        return res.status(404).send("Job not found or unauthorized");
      }

      const {
        title,
        description,
        requirements,
        location,
        type,
        internshipType = "not_applicable",
        salaryMin,
        salaryMax,
        isRemote = false,
      } = req.body;

      const [updatedJob] = await db
        .update(jobs)
        .set({
          title,
          description,
          requirements: Array.isArray(requirements)
            ? requirements
            : requirements.split("\n").filter(Boolean),
          location,
          type,
          internshipType,
          salaryMin: salaryMin ? parseInt(salaryMin) : null,
          salaryMax: salaryMax ? parseInt(salaryMax) : null,
          isRemote,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId))
        .returning();

      // Fetch the updated job with company information
      const jobWithCompany = await db.query.jobs.findFirst({
        where: eq(jobs.id, updatedJob.id),
        with: {
          company: {
            with: {
              profile: true,
            },
          },
        },
      });

      res.json(jobWithCompany);
    } catch (error) {
      console.error("Error updating job:", error);
      res.status(500).json({
        message: "Failed to update job",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Delete job endpoint
  app.delete("/api/jobs/:jobId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) {
      return res.status(400).send("Invalid job ID");
    }

    try {
      // Check if job exists and belongs to the user
      const [existingJob] = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.userId, (req.user as User).id)))
        .limit(1);

      if (!existingJob) {
        return res.status(404).send("Job not found or unauthorized");
      }

      // First delete all applications for this job
      await db.delete(jobApplications).where(eq(jobApplications.jobId, jobId));

      // Then delete the job
      const [deletedJob] = await db
        .delete(jobs)
        .where(eq(jobs.id, jobId))
        .returning();

      res.json(deletedJob);
    } catch (error) {
      console.error("Error deleting job:", error);
      res.status(500).json({
        message: "Failed to delete job",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Configure multer for file uploads
  const storageResume = multer.diskStorage({
    destination: "./uploads/resumes",
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${randomBytes(6).toString("hex")}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  });

  const uploadResume = multer({
    storage: storageResume,
    fileFilter: (req, file, cb) => {
      const allowedTypes = [".pdf", ".doc", ".docx"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(
          new Error(
            "Invalid file type. Only PDF and Word documents are allowed."
          )
        );
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
  });

  // Job application route
  app.post(
    "/api/jobs/:jobId/apply",
    uploadResume.single("resumeFile"),
    async (req, res) => {
      if (!req.isAuthenticated()) {
        return res.status(401).send("Not logged in");
      }

      if (!req.file) {
        return res.status(400).send("Resume file is required");
      }

      const jobId = parseInt(req.params.jobId);
      if (isNaN(jobId)) {
        return res.status(400).send("Invalid job ID");
      }

      try {
        // Check if user is a student with free tier
        if (
          (req.user as User).role === "student" &&
          (req.user as User).tier === "free"
        ) {
          // Count existing applications
          const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(jobApplications)
            .where(eq(jobApplications.userId, (req.user as User).id));

          if (count >= 2) {
            return res
              .status(403)
              .send(
                "You have reached the maximum number of job applications for free tier. Please upgrade your account to apply for more jobs."
              );
          }
        }

        // Check if user has already applied
        const [existingApplication] = await db
          .select()
          .from(jobApplications)
          .where(
            and(
              eq(jobApplications.jobId, jobId),
              eq(jobApplications.userId, (req.user as User).id)
            )
          )
          .limit(1);

        if (existingApplication) {
          return res.status(400).send("You have already applied for this job");
        }

        // Create new application
        const [application] = await db
          .insert(jobApplications)
          .values({
            jobId,
            userId: (req.user as User).id,
            resumeUrl: req.file.path,
            coverLetter: req.body.coverLetter,
            status: "pending",
          })
          .returning();

        res.json(application);
      } catch (error) {
        console.error("Application error:", error);
        res.status(500).send("Failed to submit application");
      }
    }
  );

  // Serve uploaded files
  app.use("/uploads", express.static("uploads"));

  // Onboarding completion route
  app.post("/api/onboarding/complete", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      const [updatedUser] = await db
        .update(users)
        .set({ hasCompletedOnboarding: true })
        .where(eq(users.id, (req.user as User).id))
        .returning();

      res.json(updatedUser);
    } catch (error) {
      console.error("Failed to update onboarding status:", error);
      res.status(500).send("Failed to update onboarding status");
    }
  });

  // New route for fetching candidates (student profiles)
  app.get("/api/candidates", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    if (!["startup", "venture_capitalist"].includes((req.user as User).role)) {
      return res.status(403).send("Only companies can create company profiles");
    }

    try {
      const candidates = await db.query.profiles.findMany({
        where: exists(
          db
            .select()
            .from(users)
            .where(
              and(eq(users.id, profiles.userId), eq(users.role, "student"))
            )
        ),
        with: {
          user: true,
        },
      });

      res.json(candidates);
    } catch (error) {
      console.error("Error fetching candidates:", error);
      res.status(500).json({
        message: "Failed to fetch candidates",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Add this new endpoint after the /api/candidates endpoint
  app.get("/api/students", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      const students = await db.query.profiles.findMany({
        where: exists(db.select().from(users).where(eq(users.role, "student"))),
      });

      res.json(students);
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({
        message: "Failed to fetch students",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Network connection requests
  app.get("/api/network/requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      const pendingRequests = await db.query.networkConnections.findMany({
        where: and(
          eq(networkConnections.toUserId, (req.user as User).id),
          eq(networkConnections.type, "pending")
        ),
        with: {
          fromUser: {
            with: {
              profile: true,
            },
          },
        },
        orderBy: desc(networkConnections.createdAt),
      });

      res.json(pendingRequests);
    } catch (error) {
      console.error("Error fetching network requests:", error);
      res.status(500).json({
        message: "Failed to fetch network requests",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
  app.post("/api/network/requests/:requestId/response", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const requestId = parseInt(req.params.requestId);
    if (isNaN(requestId)) {
      return res.status(400).send("Invalid request ID");
    }

    const { status } = req.body;
    if (!status || !["connected", "rejected"].includes(status)) {
      return res
        .status(400)
        .send("Invalid status - must be 'connected' or 'rejected'");
    }

    try {
      const [connection] = await db
        .select()
        .from(networkConnections)
        .where(
          and(
            eq(networkConnections.id, requestId),
            eq(networkConnections.toUserId, (req.user as User).id),
            eq(networkConnections.type, "pending")
          )
        )
        .limit(1);

      if (!connection) {
        return res.status(404).send("Connection request not found");
      }

      const [updated] = await db
        .update(networkConnections)
        .set({ type: status })
        .where(eq(networkConnections.id, requestId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating network request:", error);
      res.status(500).json({
        message: "Failed to update network request",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Network status and connection endpoints
  app.get("/api/network/status/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const targetUserId = parseInt(req.params.userId);
    if (isNaN(targetUserId)) {
      return res.status(400).send("Invalid user ID");
    }

    try {
      const [connection] = await db
        .select()
        .from(networkConnections)
        .where(
          or(
            and(
              eq(networkConnections.fromUserId, (req.user as User).id),
              eq(networkConnections.toUserId, targetUserId)
            ),
            and(
              eq(networkConnections.fromUserId, targetUserId),
              eq(networkConnections.toUserId, (req.user as User).id)
            )
          )
        )
        .limit(1);

      if (!connection) {
        return res.json("not_connected");
      }

      // Return the actual connection type regardless of who initiated it
      return res.json(connection.type);
    } catch (error) {
      console.error("Error checking connection status:", error);
      res.status(500).json({
        message: "Failed to check connection status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/network/connect/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const targetUserId = parseInt(req.params.userId);
    if (isNaN(targetUserId)) {
      return res.status(400).send("Invalid user ID");
    }

    try {
      // Check if user is a student
      if ((req.user as User).tier === "free") {
        // Get user's creation date
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, (req.user as User).id))
          .limit(1);

        const userCreatedAt = new Date(user.createdAt ?? Date.now());
        const now = new Date();

        // Calculate the start of the current week based on user's creation date
        const weeksSinceCreation = Math.floor(
          (now.getTime() - userCreatedAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        const currentWeekStart = new Date(
          userCreatedAt.getTime() + weeksSinceCreation * 7 * 24 * 60 * 60 * 1000
        );

        // Count connections made this week
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(networkConnections)
          .where(
            and(
              eq(networkConnections.fromUserId, (req.user as User).id),
              gte(networkConnections.createdAt, currentWeekStart)
            )
          );

        if (count >= 4) {
          // Calculate days remaining until next week
          const nextWeekStart = new Date(
            currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000
          );
          const daysRemaining = Math.ceil(
            (nextWeekStart.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          );

          return res
            .status(429)
            .send(
              `You have reached the weekly limit of 4 connection requests. Please try again in ${daysRemaining} day${
                daysRemaining > 1 ? "s" : ""
              }.`
            );
        }
      }

      // Check if user exists
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (!targetUser) {
        return res.status(404).send("User not found");
      }

      // Check if connection already exists
      const [existingConnection] = await db
        .select()
        .from(networkConnections)
        .where(
          or(
            and(
              eq(networkConnections.fromUserId, (req.user as User).id),
              eq(networkConnections.toUserId, targetUserId)
            ),
            and(
              eq(networkConnections.fromUserId, targetUserId),
              eq(networkConnections.toUserId, (req.user as User).id)
            )
          )
        )
        .limit(1);

      if (existingConnection) {
        return res.status(400).send("Connection already exists");
      }

      // Create new connection request
      const [connection] = await db
        .insert(networkConnections)
        .values({
          fromUserId: (req.user as User).id,
          toUserId: targetUserId,
          type: "pending",
        })
        .returning();

      res.json(connection);
    } catch (error) {
      console.error("Error creating connection request:", error);
      res.status(500).json({
        message: "Failed to create connection request",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get applications received for company's job postings
  app.get("/api/applications/received", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    if (!["startup", "venture_capitalist"].includes((req.user as User).role)) {
      return res.status(403).send("Only companies can create company profiles");
    }

    try {
      const receivedApplications = await db.query.jobs.findMany({
        where: eq(jobs.userId, (req.user as User).id),
        with: {
          applications: {
            with: {
              user: {
                with: {
                  profile: true,
                },
              },
            },
            orderBy: [desc(jobApplications.createdAt)],
          },
        },
      });

      // Flatten the nested structure to match the expected format
      const applications = receivedApplications.flatMap((job) =>
        job.applications.map((app) => ({
          ...app,
          job: {
            id: job.id,
            title: job.title,
            type: job.type,
            location: job.location,
          },
        }))
      );

      res.json(applications);
    } catch (error) {
      console.error("Error fetching received applications:", error);
      res.status(500).json({
        message: "Failed to fetch received applications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Network status and connection endpoints
  app.get("/api/network/status/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const targetUserId = parseInt(req.params.userId);
    if (isNaN(targetUserId)) {
      return res.status(400).send("Invalid user ID");
    }

    try {
      const [connection] = await db
        .select()
        .from(networkConnections)
        .where(
          or(
            and(
              eq(networkConnections.fromUserId, (req.user as User).id),
              eq(networkConnections.toUserId, targetUserId)
            ),
            and(
              eq(networkConnections.fromUserId, targetUserId),
              eq(networkConnections.toUserId, (req.user as User).id)
            )
          )
        )
        .limit(1);

      if (!connection) {
        return res.json("not_connected");
      }

      // Return the actual connection type regardless of who initiated it
      return res.json(connection.type);
    } catch (error) {
      console.error("Error checking connection status:", error);
      res.status(500).json({
        message: "Failed to check connection status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/network/connect/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const targetUserId = parseInt(req.params.userId);
    if (isNaN(targetUserId)) {
      return res.status(400).send("Invalid user ID");
    }

    try {
      // Check if user exists
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (!targetUser) {
        return res.status(404).send("User not found");
      }

      // Check if connection already exists
      const [existingConnection] = await db
        .select()
        .from(networkConnections)
        .where(
          or(
            and(
              eq(networkConnections.fromUserId, (req.user as User).id),
              eq(networkConnections.toUserId, targetUserId)
            ),
            and(
              eq(networkConnections.fromUserId, targetUserId),
              eq(networkConnections.toUserId, (req.user as User).id)
            )
          )
        )
        .limit(1);

      if (existingConnection) {
        return res.status(400).send("Connection already exists");
      }

      // Create new connection request
      const [connection] = await db
        .insert(networkConnections)
        .values({
          fromUserId: (req.user as User).id,
          toUserId: targetUserId,
          type: "pending",
        })
        .returning();

      res.json(connection);
    } catch (error) {
      console.error("Error creating connection request:", error);
      res.status(500).json({
        message: "Failed to create connection request",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get applications received for company's job postings
  app.get("/api/applications/received", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    if (!["startup", "venture_capitalist"].includes((req.user as User).role)) {
      return res.status(403).send("Only companies can create company profiles");
    }

    try {
      const receivedApplications = await db.query.jobs.findMany({
        where: eq(jobs.userId, (req.user as User).id),
        with: {
          applications: {
            with: {
              user: {
                with: {
                  profile: true,
                },
              },
            },
            orderBy: [desc(jobApplications.createdAt)],
          },
        },
      });

      // Flatten the nested structure to match the expected format
      const applications = receivedApplications.flatMap((job) =>
        job.applications.map((app) => ({
          ...app,
          job: {
            id: job.id,
            title: job.title,
            type: job.type,
            location: job.location,
          },
        }))
      );

      res.json(applications);
    } catch (error) {
      console.error("Error fetching received applications:", error);
      res.status(500).json({
        message: "Failed to fetch received applications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Network status and connection endpoints
  app.get("/api/network/status/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const targetUserId = parseInt(req.params.userId);
    if (isNaN(targetUserId)) {
      return res.status(400).send("Invalid user ID");
    }

    try {
      const [connection] = await db
        .select()
        .from(networkConnections)
        .where(
          or(
            and(
              eq(networkConnections.fromUserId, (req.user as User).id),
              eq(networkConnections.toUserId, targetUserId)
            ),
            and(
              eq(networkConnections.fromUserId, targetUserId),
              eq(networkConnections.toUserId, (req.user as User).id)
            )
          )
        )
        .limit(1);

      if (!connection) {
        return res.json("not_connected");
      }

      // Return the actual connection type regardless of who initiated it
      return res.json(connection.type);
    } catch (error) {
      console.error("Error checking connection status:", error);
      res.status(500).json({
        message: "Failed to check connection status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/network/connect/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const targetUserId = parseInt(req.params.userId);
    if (isNaN(targetUserId)) {
      return res.status(400).send("Invalid user ID");
    }

    try {
      // Check if user exists
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (!targetUser) {
        return res.status(404).send("User not found");
      }

      // Check if connection already exists
      const [existingConnection] = await db
        .select()
        .from(networkConnections)
        .where(
          or(
            and(
              eq(networkConnections.fromUserId, (req.user as User).id),
              eq(networkConnections.toUserId, targetUserId)
            ),
            and(
              eq(networkConnections.fromUserId, targetUserId),
              eq(networkConnections.toUserId, (req.user as User).id)
            )
          )
        )
        .limit(1);

      if (existingConnection) {
        return res.status(400).send("Connection already exists");
      }

      // Create new connection request
      const [connection] = await db
        .insert(networkConnections)
        .values({
          fromUserId: (req.user as User).id,
          toUserId: targetUserId,
          type: "pending",
        })
        .returning();

      res.json(connection);
    } catch (error) {
      console.error("Error creating connection request:", error);
      res.status(500).json({
        message: "Failed to create connection request",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get applications received for company's job postings
  app.get("/api/applications/received", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    if (!["startup", "venture_capitalist"].includes((req.user as User).role)) {
      return res.status(403).send("Only companies can create company profiles");
    }

    try {
      const receivedApplications = await db.query.jobs.findMany({
        where: eq(jobs.userId, (req.user as User).id),
        with: {
          applications: {
            with: {
              user: {
                with: {
                  profile: true,
                },
              },
            },
            orderBy: [desc(jobApplications.createdAt)],
          },
        },
      });

      // Flatten the nested structure to match the expected format
      const applications = receivedApplications.flatMap((job) =>
        job.applications.map((app) => ({
          ...app,
          job: {
            id: job.id,
            title: job.title,
            type: job.type,
            location: job.location,
          },
        }))
      );

      res.json(applications);
    } catch (error) {
      console.error("Error fetching received applications:", error);
      res.status(500).json({
        message: "Failed to fetch received applications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Update application status
  app.put("/api/applications/:applicationId/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    if (!["startup", "venture_capitalist"].includes((req.user as User).role)) {
      return res.status(403).send("Only companies can create company profiles");
    }

    const applicationId = parseInt(req.params.applicationId);
    if (isNaN(applicationId)) {
      return res.status(400).send("Invalid application ID");
    }

    try {
      // Verify the application belongs to one of the company's jobs
      const [application] = await db
        .select()
        .from(jobApplications)
        .where(
          and(
            eq(jobApplications.id, applicationId),
            eq(jobs.userId, (req.user as User).id)
          )
        )
        .innerJoin(jobs, eq(jobApplications.jobId, jobs.id))
        .limit(1);

      if (!application) {
        return res.status(404).send("Application not found or unauthorized");
      }

      const { status } = req.body;
      if (
        ![
          "pending",
          "reviewed",
          "interviewing",
          "accepted",
          "rejected",
        ].includes(status)
      ) {
        return res.status(400).send("Invalid status");
      }

      const [updated] = await db
        .update(jobApplications)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(jobApplications.id, applicationId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating application status:", error);
      res.status(500).json({
        message: "Failed to update application status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get company's posted jobs
  app.get("/api/jobs/posted", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    if (!["startup", "venture_capitalist"].includes((req.user as User).role)) {
      return res.status(403).send("Only companies can create company profiles");
    }

    try {
      const postedJobs = await db.query.jobs.findMany({
        where: eq(jobs.userId, (req.user as User).id),
        orderBy: desc(jobs.createdAt),
      });

      res.json(postedJobs);
    } catch (error) {
      console.error("Error fetching posted jobs:", error);
      res.status(500).json({
        message: "Failed to fetch posted jobs",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get individual profile with connection status
  app.get("/api/profile/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).send("Invalid user ID");
    }

    try {
      // Get user and their profile
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!targetUser) {
        return res.status(404).send("User not found");
      }

      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      // Check connection status
      const [connection] = await db
        .select()
        .from(networkConnections)
        .where(
          or(
            and(
              eq(networkConnections.fromUserId, (req.user as User).id),
              eq(networkConnections.toUserId, userId)
            ),
            and(
              eq(networkConnections.fromUserId, userId),
              eq(networkConnections.toUserId, (req.user as User).id)
            )
          )
        )
        .limit(1);
      const isConnected = connection?.type === "connected";
      const connectionStatus = connection?.type;
      // check intro table is user existed with id if yes then hasIntroRequest should be targetUser
      const [introRequest] = await db
        .select()
        .from(intros)
        .where(
          or(
            and(
              eq(intros.targetId, userId),
              eq(intros.requesterId, (req.user as User).id),
              eq(intros.status, "pending")
            ), // Sent request
            and(
              eq(intros.targetId, (req.user as User).id),
              eq(intros.requesterId, userId),
              eq(intros.status, "pending")
            ) // Received request
          )
        )
        .limit(1);

      const hasIntroRequest = !!introRequest;
      res.json({
        user: targetUser,
        profile,
        isConnected,
        connectionStatus,
        hasIntroRequest,
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({
        message: "Failed to fetch profile",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Send a message to a connection
  // app.post("/api/messages/:userId", async (req, res) => {
  //   if (!req.isAuthenticated()) {
  //     return res.status(401).send("Not logged in");
  //   }

  //   const otherUserId = parseInt(req.params.userId);
  //   if (isNaN(otherUserId)) {
  //     return res.status(400).send("Invalid user ID");
  //   }

  //   try {
  //     // Validate message content
  //     const { content } = req.body;
  //     if (!content || typeof content !== "string" || content.length === 0) {
  //       return res.status(400).send("Message content is required");
  //     }

  //     // Check if users are connected
  //     const [connection] = await db
  //       .select()
  //       .from(networkConnections)
  //       .where(
  //         and(
  //           or(
  //             and(
  //               eq(networkConnections.fromUserId, (req.user as User).id),
  //               eq(networkConnections.toUserId, otherUserId)
  //             ),
  //             and(
  //               eq(networkConnections.fromUserId, otherUserId),
  //               eq(networkConnections.toUserId, (req.user as User).id)
  //             )
  //           ),
  //           eq(networkConnections.type, "connected")
  //         )
  //       )
  //       .limit(1);

  //     if (!connection) {
  //       return res
  //         .status(403)
  //         .send("You must be connected with this user to send messages");
  //     }

  //     // Create message
  //     const [message] = await db
  //       .insert(messages)
  //       .values({
  //         content: content,
  //         fromUserId: (req.user as User).id,
  //         toUserId: otherUserId,
  //       })
  //       .returning();

  //     // Return the created message
  //     return res.json(message);
  //   } catch (error) {
  //     console.error("Error sending message:", error);
  //     res.status(500).json({
  //       message: "Failed to send message",
  //       error: error instanceof Error ? error.message : "Unknown error",
  //     });
  //   }
  // });

  // Check if two users are connected
  app.get("/api/network/connected/:otherUserId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const otherUserId = parseInt(req.params.otherUserId);
    if (isNaN(otherUserId)) {
      return res.status(400).send("Invalid user ID");
    }

    try {
      const [connection] = await db
        .select()
        .from(networkConnections)
        .where(
          and(
            or(
              and(
                eq(networkConnections.fromUserId, (req.user as User).id),
                eq(networkConnections.toUserId, otherUserId)
              ),
              and(
                eq(networkConnections.fromUserId, otherUserId),
                eq(networkConnections.toUserId, (req.user as User).id)
              )
            ),
            eq(networkConnections.type, "connected")
          )
        )
        .limit(1);

      res.json({ connected: !!connection });
    } catch (error) {
      console.error("Error checking connection status:", error);
      res.status(500).json({
        message: "Failed to check connection status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Messages routes
  app.get("/api/messages/connections", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      // Get all connected users
      const connections = await db.query.networkConnections.findMany({
        where: and(
          or(
            eq(networkConnections.fromUserId, (req.user as User).id),
            eq(networkConnections.toUserId, (req.user as User).id)
          ),
          eq(networkConnections.type, "connected") // Only show established connections
        ),
        with: {
          fromUser: {
            with: {
              profile: true,
            },
          },
          toUser: {
            with: {
              profile: true,
            },
          },
        },
      });

      // Transform connections to get connected users
      const connectedUsers = await Promise.all(
        connections.map(async (conn) => {
          // Get the other user in the connection (not the current user)
          const otherUser =
            conn.fromUserId === (req.user as User).id
              ? conn.toUser
              : conn.fromUser;

          // Get last message between users
          const [lastMessage] = await db
            .select({
              id: messages.id,
              content: messages.content,
              status: messages.status,
              createdAt: messages.createdAt,
              fromUserId: messages.fromUserId,
              toUserId: messages.toUserId,
            })
            .from(messages)
            .where(
              or(
                and(
                  eq(messages.fromUserId, (req.user as User).id),
                  eq(messages.toUserId, otherUser.id)
                ),
                and(
                  eq(messages.fromUserId, otherUser.id),
                  eq(messages.toUserId, (req.user as User).id)
                )
              )
            )
            .orderBy(desc(messages.createdAt))
            .limit(1);

          // Count unread messages from this connection
          const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(messages)
            .where(
              and(
                eq(messages.fromUserId, otherUser.id),
                eq(messages.toUserId, (req.user as User).id),
                eq(messages.status, "sent")
              )
            );

          return {
            user: otherUser,
            lastMessage,
            unreadCount: Number(count),
          };
        })
      );

      res.json(connectedUsers);
    } catch (error) {
      console.error("Error fetching message connections:", error);
      res.status(500).json({
        message: "Failed to fetch message connections",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/messages/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const otherUserId = parseInt(req.params.userId);
    if (isNaN(otherUserId)) {
      return res.status(400).send("Invalid user ID");
    }
    try {
      const result = await db.transaction(async (tx) => {
        // First verify the other user exists
        const [otherUser] = await tx
          .select()
          .from(users)
          .where(eq(users.id, otherUserId))
          .limit(1);

        if (!otherUser) {
          throw new Error("User not found");
        }

        // Check if users are connected
        const [connection] = await tx
          .select()
          .from(networkConnections)
          .where(
            and(
              or(
                and(
                  eq(networkConnections.fromUserId, (req.user as User).id),
                  eq(networkConnections.toUserId, otherUserId)
                ),
                and(
                  eq(networkConnections.fromUserId, otherUserId),
                  eq(networkConnections.toUserId, (req.user as User).id)
                )
              ),
              eq(networkConnections.type, "connected")
            )
          )
          .limit(1);

        if (!connection) {
          throw new Error("Users are not connected");
        }

        // Update unread messages first
        await tx
          .update(messages)
          .set({
            status: "read",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(messages.fromUserId, otherUserId),
              eq(messages.toUserId, (req.user as User).id),
              eq(messages.status, "sent")
            )
          );

        // Then get all messages between users
        const messageList = await tx.query.messages.findMany({
          where: or(
            and(
              eq(messages.fromUserId, (req.user as User).id),
              eq(messages.toUserId, otherUserId)
            ),
            and(
              eq(messages.fromUserId, otherUserId),
              eq(messages.toUserId, (req.user as User).id)
            )
          ),
          with: {
            fromUser: {
              with: {
                profile: true,
              },
            },
          },
          orderBy: asc(messages.createdAt),
        });

        return messageList;
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching messages:", error);
      if (error instanceof Error) {
        if (error.message === "User not found") {
          return res.status(404).send(error.message);
        }
        if (error.message === "Users are not connected") {
          return res.status(403).send(error.message);
        }
      }
      res.status(500).json({
        message: "Failed to fetch messages",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Send a message to another user
  app.post("/api/messages/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const otherUserId = parseInt(req.params.userId);
    if (isNaN(otherUserId)) {
      return res.status(400).send("Invalid user ID");
    }

    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).send("Message content is required");
    }

    try {
      // Verify users are connected
      const [connection] = await db
        .select()
        .from(networkConnections)
        .where(
          and(
            or(
              and(
                eq(networkConnections.fromUserId, (req.user as User).id),
                eq(networkConnections.toUserId, otherUserId)
              ),
              and(
                eq(networkConnections.fromUserId, otherUserId),
                eq(networkConnections.toUserId, (req.user as User).id)
              )
            ),
            eq(networkConnections.type, "connected")
          )
        )
        .limit(1);

      if (!connection) {
        return res
          .status(403)
          .send("Cannot send message to non-connected user");
      }

      // Create new message
      const [newMessage] = await db
        .insert(messages)
        .values({
          fromUserId: (req.user as User).id,
          toUserId: otherUserId,
          content: content.trim(),
        })
        .returning();

      // Return the message with sender information
      const messageWithUser = await db.query.messages.findFirst({
        where: eq(messages.id, newMessage.id),
        with: {
          fromUser: {
            with: {
              profile: true,
            },
          },
        },
      });

      res.json(messageWithUser);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({
        message: "Failed to send message",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Message status update endpoint
  app.post("/api/messages/:messageId/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    const messageId = parseInt(req.params.messageId);
    if (isNaN(messageId)) {
      return res.status(400).send("Invalid message ID");
    }

    try {
      // Get the message
      const [message] = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.id, messageId),
            eq(messages.toUserId, (req.user as User).id)
          )
        )
        .limit(1);

      if (!message) {
        return res.status(404).send("Message not found");
      }

      // Update message status
      const [updatedMessage] = await db
        .update(messages)
        .set({
          status: "delivered" as const,
          updatedAt: new Date(),
        })
        .where(eq(messages.id, messageId))
        .returning();

      res.json(updatedMessage);
    } catch (error) {
      console.error("Error updating message status:", error);
      res.status(500).json({
        message: "Failed to update message status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/network/suggestions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      // Get user's existing connections
      const connections = await db
        .select()
        .from(networkConnections)
        .where(
          or(
            eq(networkConnections.fromUserId, (req.user as User).id),
            eq(networkConnections.toUserId, (req.user as User).id)
          )
        );

      // Get connected user ids
      const connectedUserIds = connections.map((conn) =>
        conn.fromUserId === (req.user as User).id
          ? conn.toUserId
          : conn.fromUserId
      );

      // Get users who are not yet connected
      const suggestions = await db.query.users.findMany({
        where: and(
          ne(users.id, (req.user as User).id),
          notInArray(users.id, connectedUserIds)
        ),
        with: {
          profile: true,
        },
        limit: 5,
      });

      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching network suggestions:", error);
      res.status(500).json({
        message: "Failed to fetch suggestions",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Set up file serving for uploaded files
  app.use("/uploads", express.static("uploads"));

  app.get("/api/applications", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not logged in" });
    }

    try {
      const jobListings = await db.query.jobApplications.findMany({
        where: eq(jobs.userId, (req.user as User).id),
        with: {
          job: true,
          user: {
            with: {
              profile: true,
            },
          },
        },
        orderBy: [desc(jobApplications.createdAt)],
      });
      // Flatten the nested structure to match the expected format
      const applications = jobListings.map((application) => ({
        ...application,
        job: {
          id: application.job.id,
          title: application.job.title,
          type: application.job.type,
          location: application.job.location,
        },
      }));

      res.setHeader("Content-Type", "application/json");
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({
        message: "Failed to fetch applications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/applications/hire", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not logged in" });
    }

    try {
      const jobListings = await db.query.jobApplications.findMany({
        where: (jobApplication, { eq, inArray }) =>
          inArray(
            jobApplication.jobId,
            db
              .select({ id: jobs.id })
              .from(jobs)
              .where(eq(jobs.userId, (req.user as User).id))
          ),
        with: {
          job: true,
          user: {
            with: {
              profile: true,
            },
          },
        },
        orderBy: [desc(jobApplications.createdAt)],
      });
      // Flatten the nested structure to match the expected format
      const applications = jobListings.map((application) => ({
        ...application,
        job: {
          id: application.job.id,
          title: application.job.title,
          type: application.job.type,
          location: application.job.location,
        },
      }));

      res.setHeader("Content-Type", "application/json");
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({
        message: "Failed to fetch applications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/intros/request", createIntroRequest);
  app.get("/api/intros/pending", getPendingIntros);
  app.put("/api/intros/respond", respondToIntroRequest);

  // Update the student profile endpoint
  app.post(
    "/api/student-profile",
    uploadProfile.single("avatar"),
    async (req, res) => {
      if (!req.isAuthenticated()) {
        return res.status(401).send("Not logged in");
      }

      if ((req.user as User).role !== "student") {
        return res
          .status(403)
          .send("Only students can create student profiles");
      }

      try {
        const [existing] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.userId, (req.user as User).id))
          .limit(1);

        // Create profile data with all student fields
        const profileData = {
          name: req.body.name,
          bio: req.body.bio,
          location: req.body.location,
          university: req.body.university,
          graduationYear: req.body.graduationYear,
          linkedIn: req.body.linkedIn,
          // Add the additional fields
          major: req.body.major,
          previousExperience: req.body.previousExperience,
          careerGoals: req.body.careerGoals,
          // Handle avatar
          avatarUrl: req.file
            ? `/uploads/avatars/${req.file.filename}`
            : existing?.avatarUrl,
          type: "student",
        };

        // Handle skills array
        if (req.body.skills) {
          let skills;
          if (Array.isArray(req.body.skills)) {
            skills = req.body.skills;
          } else {
            try {
              skills = JSON.parse(req.body.skills);
            } catch {
              skills = req.body.skills
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);
            }
          }
          profileData.skills = skills;
        }

        if (existing) {
          const [updated] = await db
            .update(profiles)
            .set(profileData)
            .where(eq(profiles.id, existing.id))
            .returning();
          return res.json(updated);
        }

        const [profile] = await db
          .insert(profiles)
          .values({ ...profileData, userId: (req.user as User).id })
          .returning();

        res.json(profile);
      } catch (error) {
        console.error("Profile update error:", error);
        res.status(500).json({
          message: "Failed to update profile",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Update the company profile endpoint
  app.post(
    "/api/company-profile",
    uploadProfile.single("avatar"),
    async (req, res) => {
      if (!req.isAuthenticated()) {
        return res.status(401).send("Not logged in");
      }

      if (
        !["startup", "venture_capitalist"].includes((req.user as User).role)
      ) {
        return res
          .status(403)
          .send("Only companies can create company profiles");
      }

      try {
        const [existing] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.userId, (req.user as User).id))
          .limit(1);

        // Create profile data with all company fields
        const profileData = {
          name: req.body.name,
          bio: req.body.bio,
          location: req.body.location,
          company: req.body.company,
          website: req.body.website,
          linkedIn: req.body.linkedIn,
          industry: req.body.industry,
          companySize: req.body.companySize,
          fundingStage: req.body.fundingStage,
          mission: req.body.mission,
          cultureValues: req.body.cultureValues,
          // Add VC-specific fields
          investmentThesis: req.body.investmentThesis,
          portfolioSize: req.body.portfolioSize,
          investmentRange: req.body.investmentRange,
          // Handle avatar
          avatarUrl: req.file
            ? `/uploads/avatars/${req.file.filename}`
            : existing?.avatarUrl,
          type: (req.user as User).role,
        };

        // Handle skills array
        if (req.body.skills) {
          profileData.skills = normalizeField(req.body.skills);
        }

        // Handle industry array
        if (req.body.industry) {
          profileData.industry = normalizeField(req.body.industry);
        }

        if (existing) {
          const [updated] = await db
            .update(profiles)
            .set(profileData)
            .where(eq(profiles.id, existing.id))
            .returning();
          return res.json(updated);
        }

        const [profile] = await db
          .insert(profiles)
          .values({ ...profileData, userId: (req.user as User).id })
          .returning();

        res.json(profile);
      } catch (error) {
        console.error("Profile update error:", error);
        res.status(500).json({
          message: "Failed to update profile",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  app.get("/api/highlights", getHighlights);
  app.post("/api/highlights", uploadHighlight.single("file"), createHighlight);
  app.delete("/api/highlights/:id", deleteHighlight);

  // Add these admin job management routes after your existing admin routes

  app.get("/api/admin/jobs", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    try {
      const {
        search,
        type,
        internshipType,
        salaryMin,
        salaryMax,
        isRemote,
        page = "1",
        perPage = "10",
      } = req.query;

      const pageNumber = parseInt(page as string);
      const itemsPerPage = parseInt(perPage as string);
      const offset = (pageNumber - 1) * itemsPerPage;

      // Build conditions array for the where clause
      const conditions = [];

      if (search) {
        conditions.push(
          or(
            ilike(jobs.title, `%${search}%`),
            ilike(jobs.description, `%${search}%`),
            ilike(jobs.location, `%${search}%`)
          )
        );
      }

      if (type && type !== "all") {
        conditions.push(
          eq(
            jobs.type,
            type as "full_time" | "part_time" | "internship" | "contract"
          )
        );
      }

      if (internshipType && internshipType !== "all") {
        conditions.push(
          eq(
            jobs.internshipType,
            internshipType as "paid" | "unpaid" | "not_applicable"
          )
        );
      }

      if (salaryMin) {
        conditions.push(gte(jobs.salaryMin, parseInt(salaryMin as string)));
      }

      if (salaryMax) {
        conditions.push(lte(jobs.salaryMax, parseInt(salaryMax as string)));
      }

      if (isRemote === "true") {
        conditions.push(eq(jobs.isRemote, true));
      }

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobs)
        .where(and(...conditions));

      // Get paginated jobs
      const jobsList = await db
        .select({
          id: jobs.id,
          title: jobs.title,
          description: jobs.description,
          type: jobs.type,
          location: jobs.location,
          salaryMin: jobs.salaryMin,
          salaryMax: jobs.salaryMax,
          isRemote: jobs.isRemote,
          createdAt: jobs.createdAt,
          user: {
            id: users.id,
            username: users.username,
            profile: {
              name: profiles.name,
              email: users.email,
            },
          },
        })
        .from(jobs)
        .innerJoin(users, eq(jobs.userId, users.id))
        .leftJoin(profiles, eq(users.id, profiles.userId))
        .where(and(...conditions))
        .orderBy(desc(jobs.createdAt))
        .limit(itemsPerPage)
        .offset(offset);

      res.json({
        jobs: jobsList,
        pagination: {
          total: count,
          pages: Math.ceil(count / itemsPerPage),
        },
      });
    } catch (error) {
      console.error("Error fetching admin jobs:", error);
      res.status(500).json({
        message: "Failed to fetch jobs",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.put("/api/admin/jobs/:jobId", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) {
      return res.status(400).json({ message: "Invalid job ID" });
    }

    try {
      const [updatedJob] = await db
        .update(jobs)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId))
        .returning();

      res.json(updatedJob);
    } catch (error) {
      console.error("Error updating job:", error);
      res.status(500).json({
        message: "Failed to update job",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.delete("/api/admin/jobs/:jobId", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) {
      return res.status(400).json({ message: "Invalid job ID" });
    }

    try {
      // First delete all applications for this job
      await db.delete(jobApplications).where(eq(jobApplications.jobId, jobId));

      // Then delete the job
      const [deletedJob] = await db
        .delete(jobs)
        .where(eq(jobs.id, jobId))
        .returning();

      res.json(deletedJob);
    } catch (error) {
      console.error("Error deleting job:", error);
      res.status(500).json({
        message: "Failed to delete job",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/highlights/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      const targetUserId = parseInt(req.params.userId);
      const currentUserId = (req.user as User).id;

      // Check if users are connected (if not viewing own profile)
      let isConnected = false;
      if (targetUserId !== currentUserId) {
        const [connection] = await db
          .select()
          .from(networkConnections)
          .where(
            and(
              or(
                and(
                  eq(networkConnections.fromUserId, currentUserId),
                  eq(networkConnections.toUserId, targetUserId)
                ),
                and(
                  eq(networkConnections.fromUserId, targetUserId),
                  eq(networkConnections.toUserId, currentUserId)
                )
              ),
              eq(networkConnections.type, "connected")
            )
          )
          .limit(1);

        isConnected = !!connection;
      }

      // Get highlights
      const userHighlights = await db
        .select()
        .from(highlights)
        .where(eq(highlights.userId, targetUserId))
        .orderBy(desc(highlights.createdAt));

      // If not connected and not own profile, only return basic info
      if (!isConnected && targetUserId !== currentUserId) {
        const limitedHighlights = userHighlights.map((highlight) => ({
          ...highlight,
          fileUrl: "", // Don't expose file URL to non-connected users
          description: highlight.description ? "..." : null, // Mask description
        }));
        return res.json(limitedHighlights);
      }

      res.json(userHighlights);
    } catch (error) {
      console.error("Error fetching user highlights:", error);
      res.status(500).json({ error: "Failed to fetch highlights" });
    }
  });

  // Add this route to handle connection tree requests
  app.get("/api/network/connections/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    // Check if user has premium access
    if ((req.user as User).tier !== "premium") {
      return res.status(403).send("Premium subscription required");
    }

    try {
      const targetUserId = parseInt(req.params.userId);
      const depth = parseInt(req.query.depth as string) || 1;

      // Get both outgoing and incoming connections
      const connections = await db
        .select({
          id: users.id,
          name: profiles.name,
          username: users.username,
          role: users.role,
          avatarUrl: profiles.avatarUrl,
        })
        .from(networkConnections)
        .innerJoin(
          users,
          or(
            eq(networkConnections.toUserId, users.id),
            eq(networkConnections.fromUserId, users.id)
          )
        )
        .leftJoin(profiles, eq(users.id, profiles.userId))
        .where(
          and(
            or(
              eq(networkConnections.fromUserId, targetUserId),
              eq(networkConnections.toUserId, targetUserId)
            ),
            eq(networkConnections.type, "connected"),
            // Exclude the user themselves from results
            ne(users.id, targetUserId)
          )
        )
        .orderBy(desc(networkConnections.createdAt));

      // Filter out duplicates (in case of bi-directional connections)
      const uniqueConnections = Array.from(
        new Map(connections.map((item) => [item.id, item])).values()
      );

      res.json({
        nodes: uniqueConnections,
        hasMore: false,
      });
    } catch (error) {
      console.error("Error fetching connection tree:", error);
      res.status(500).json({
        message: "Failed to fetch connection tree",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/stripe/plans", getStripePlans);
  app.get("/api/stripe/subscription", getUserSubscription);
  app.post("/api/stripe/create-checkout-session", initiateSubscription);
  app.post("/webhooks/stripe", handleStripeWebhook);

  // Add these routes in the registerRoutes function
  // Stripe subscription management routes
  app.get("/api/stripe/subscription-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, (req.user as User).id))
        .limit(1);

      if (!subscription) {
        return res.json(null);
      }

      return res.json({
        id: subscription.stripeSubscriptionId,
        status: subscription.status,
        priceId: subscription.priceId,
        currentPeriodEnd: subscription.currentPeriodEnd,
      });
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch subscription status" });
    }
  });

  app.post("/api/stripe/create-portal-session", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, (req.user as User).id))
        .limit(1);

      if (!subscription?.stripeCustomerId) {
        return res.status(404).json({ message: "No subscription found" });
      }
      const allowedPriceIds =
        (req.user as User).role === "student"
          ? [
              process.env.STRIPE_STUDENT_PREMIUM_MONTHLY_PRICE_ID,
              process.env.STRIPE_STUDENT_PREMIUM_YEARLY_PRICE_ID,
            ]
          : [
              process.env.STRIPE_BUSINESS_PREMIUM_MONTHLY_PRICE_ID,
              process.env.STRIPE_BUSINESS_PREMIUM_YEARLY_PRICE_ID,
            ];
            const configuration = await stripe.billingPortal.configurations.create({
              business_profile: {
                headline: "Manage your subscription",
              },
              features: {
                subscription_update: {
                  enabled: true,
                  default_allowed_updates: ["price"],
                  proration_behavior: "create_prorations",
                  products: [
                    {
                      product: (req.user as User).role === "student" 
                        ? process.env.STRIPE_STUDENT_PREMIUM_PRODUCT_ID 
                        : process.env.STRIPE_BUSINESS_PREMIUM_PRODUCT_ID,
                      prices: allowedPriceIds,
                    },
                  ],
                },
                subscription_cancel: {
                  enabled: true,
                  mode: "at_period_end",
                  cancellation_reason: {
                    enabled: true,
                    options: [
                      "too_expensive",
                      "missing_features",
                      "switched_service",
                      "other",
                    ],
                  },
                },
                customer_update: {
                  enabled: true,
                  allowed_updates: ["email", "tax_id"],
                },
                invoice_history: { enabled: true },
                payment_method_update: { enabled: true },
              },
            });
        
            // Create the portal session
            const session = await stripe.billingPortal.sessions.create({
              customer: subscription.stripeCustomerId,
              return_url: `${process.env.CLIENT_BASE_URL}/pricing`,
              configuration: configuration.id,
            });
        

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ message: "Failed to create portal session" });
    }
  });

  // Add this endpoint in registerRoutes
  app.post("/api/candidates/interview-request", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not logged in");
    }

    try {
      const { candidateId, roleId } = req.body;

      // Get candidate profile
      const [candidate] = await db
        .select({
          name: profiles.name,
          email: users.email,
          university: profiles.university,
          bio: profiles.bio,
          previousExperience: profiles.previousExperience,
        })
        .from(profiles)
        .innerJoin(users, eq(users.id, profiles.userId))
        .where(eq(profiles.userId, candidateId))
        .limit(1);

      // Get requester (company) profile
      const [requester] = await db
        .select({
          name: profiles.name,
          company: profiles.company,
        })
        .from(profiles)
        .where(eq(profiles.userId, (req.user as User).id))
        .limit(1);

      // Get job details
      const [job] = await db
        .select({
          title: jobs.title,
        })
        .from(jobs)
        .where(eq(jobs.id, roleId))
        .limit(1);
      // merge bio + skills + previous experience
      const candidateDescription = `${candidate?.bio || ""} ${candidate?.skills || ""} ${candidate?.previousExperience || ""}`.trim();

      // Send email to candidate
      await sendEmail({
        to: candidate.email,
        campaignId: process.env.REQUEST_CANDIDATE_INTERVIEW_CAMPAIGN_ID,
        campaignData: {
          candidate_name: candidate.name,
          interviewer_name: requester.name,
          company_name: requester.company,
          role_name: job.title,
          candidate_description: candidateDescription,
        },
        templateData: {}, // Required by EmailData type
      });

      // Send email to requester
      await sendEmail({
        to: (req.user as User).email,
        campaignId: process.env.REQUEST_CANDIDATE_INTERVIEW_CAMPAIGN_ID,
        campaignData: {
          candidate_name: candidate.name,
          interviewer_name: requester.name,
          company_name: requester.company,
          role_name: job.title,
          candidate_description: candidateDescription,
        },
        templateData: {}, // Required by EmailData type
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error requesting candidate:", error);
      res.status(500).json({
        message: "Failed to request candidate",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.delete('/api/user/delete-account', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send('Not logged in');
    }
  
    try {
      const userId = (req.user as User).id;
  
      // Delete user data from all relevant tables
      await db.delete(profiles).where(eq(profiles.userId, userId));
      await db.delete(posts).where(eq(posts.userId, userId));
      await db.delete(postComments).where(eq(postComments.userId, userId));
      await db.delete(postLikes).where(eq(postLikes.userId, userId));
      await db.delete(highlights).where(eq(highlights.userId, userId));
      await db.delete(userBans).where(eq(userBans.userId, userId));
      await db.delete(jobApplications).where(eq(jobApplications.userId, userId));
      await db.delete(intros).where(eq(intros.requesterId, userId));
      await db.delete(intros).where(eq(intros.targetId, userId));
      await db.delete(networkConnections).where(eq(networkConnections.fromUserId, userId));
      await db.delete(networkConnections).where(eq(networkConnections.toUserId, userId));
      await db.delete(messages).where(eq(messages.fromUserId, userId));
      await db.delete(messages).where(eq(messages.toUserId, userId));
      await db.delete(jobs).where(eq(jobs.userId, userId));
      await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
      await db.delete(userAchievements).where(eq(userAchievements.userId, userId));
      await db.delete(userActivity).where(eq(userActivity.userId, userId));
      await db.delete(reportedPosts).where(eq(reportedPosts.reportedBy, userId));
      await db.delete(helpRequests).where(eq(helpRequests.userId, userId));
      await db.delete(userBans).where(eq(userBans.userId, userId));
      await db.delete(users).where(eq(users.id, userId)); // Finally delete the user
      req.logout((err) => {
        if (err) {
          return res.status(500).send("Logout failed");
        }
      });
      res.status(200).send('Account deleted successfully');
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}
