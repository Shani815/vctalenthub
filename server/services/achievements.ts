import { achievements, userAchievements, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";

// Initial achievement definitions
export const ACHIEVEMENTS = [
  {
    title: "Network Novice",
    description: "Make your first professional connection",
    type: "connections" as const,
    requiredProgress: 1,
    rewardPoints: 10,
    iconName: "UserPlus",
  },
  {
    title: "Connection Builder",
    description: "Connect with 10 professionals",
    type: "connections" as const,
    requiredProgress: 10,
    rewardPoints: 50,
    iconName: "Users",
  },
  {
    title: "Networking Pro",
    description: "Build a network of 50 connections",
    type: "connections" as const,
    requiredProgress: 50,
    rewardPoints: 200,
    iconName: "Network",
  },
  {
    title: "First Post",
    description: "Share your first insight or announcement",
    type: "posts" as const,
    requiredProgress: 1,
    rewardPoints: 10,
    iconName: "MessageSquare",
  },
  {
    title: "Content Creator",
    description: "Create 10 meaningful posts",
    type: "posts" as const,
    requiredProgress: 10,
    rewardPoints: 50,
    iconName: "PenTool",
  },
  {
    title: "Profile Pioneer",
    description: "Complete your professional profile",
    type: "profile" as const,
    requiredProgress: 1,
    rewardPoints: 20,
    iconName: "UserCheck",
  },
  {
    title: "Community Catalyst",
    description: "Receive 50 likes on your posts",
    type: "engagement" as const,
    requiredProgress: 50,
    rewardPoints: 100,
    iconName: "Heart",
  },
  {
    title: "Networking Ambassador",
    description: "Successfully refer 3 professionals to the platform",
    type: "referrals" as const,
    requiredProgress: 3,
    rewardPoints: 150,
    iconName: "Award",
  },
];

export async function initializeAchievements() {
  // Insert all predefined achievements if they don't exist
  for (const achievement of ACHIEVEMENTS) {
    const [existing] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.title, achievement.title))
      .limit(1);

    if (!existing) {
      await db.insert(achievements).values(achievement);
    }
  }
}

export async function initializeUserAchievements(userId: number) {
  // Get all achievements
  const allAchievements = await db.select().from(achievements);
  
  // For each achievement, create a user achievement record if it doesn't exist
  for (const achievement of allAchievements) {
    const [existing] = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, achievement.id)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(userAchievements).values({
        userId,
        achievementId: achievement.id,
        currentProgress: 0,
        status: 'locked',
      });
    }
  }
}

export async function updateAchievementProgress(
  userId: number,
  type: "connections" | "posts" | "engagement" | "profile" | "referrals",
  progress: number
) {
  // Get all achievements of the specified type
  const typeAchievements = await db
    .select()
    .from(achievements)
    .where(eq(achievements.type, type));

  // Update progress for each relevant achievement
  for (const achievement of typeAchievements) {
    const [userAchievement] = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, achievement.id)
        )
      )
      .limit(1);

    if (userAchievement && userAchievement.status !== 'completed') {
      const newProgress = progress;
      const newStatus = newProgress >= achievement.requiredProgress ? 'completed' : 'in_progress';

      await db
        .update(userAchievements)
        .set({
          currentProgress: newProgress,
          status: newStatus,
          completedAt: newStatus === 'completed' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(userAchievements.id, userAchievement.id));
    }
  }
}
