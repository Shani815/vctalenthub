import { and, desc, eq, gte, sql } from "drizzle-orm";
import { jobs, platformAnalytics, postComments, posts, userActivity, users } from "@/db/schema";

import { db } from "@/db";

export async function trackUserActivity(userId: number, activityType: string, metadata?: any) {
  try {
    await db.insert(userActivity).values({
      userId,
      activityType,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (error) {
    console.error("Error tracking user activity:", error);
  }
}

export async function getAnalytics(timeRange: number = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRange);

    // Get total users count
    const [{ totalUsers }] = await db
      .select({ totalUsers: sql<number>`count(*)::int` })
      .from(users);

    // Get daily active users (users who had activity today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [{ dailyActiveUsers }] = await db
      .select({ dailyActiveUsers: sql<number>`count(distinct user_id)::int` })
      .from(userActivity)
      .where(gte(userActivity.createdAt, today));

    // Get monthly active users
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);
    const [{ monthlyActiveUsers }] = await db
      .select({ monthlyActiveUsers: sql<number>`count(distinct user_id)::int` })
      .from(userActivity)
      .where(gte(userActivity.createdAt, firstDayOfMonth));

    // Get premium users and conversion rate
    const [{ premiumUsers }] = await db
      .select({
        premiumUsers: sql<number>`count(*) filter (where tier = 'premium')::int`,
      })
      .from(users);

    const conversionRate = totalUsers > 0 
      ? Number(((premiumUsers / totalUsers) * 100).toFixed(1))
      : 0;

    // Get top job posters within time range
    const jobPosters = await db
      .select({
        userId: jobs.userId,
        username: users.username,
        count: sql<number>`count(*)::int`,
      })
      .from(jobs)
      .innerJoin(users, eq(jobs.userId, users.id))
      .where(gte(jobs.createdAt, startDate))
      .groupBy(jobs.userId, users.username)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(5);

    // Get most engaged users within time range
    const engagedUsers = await db
      .select({
        userId: users.id,
        username: users.username,
        postCount: sql<number>`count(distinct ${posts.id})::int`,
        commentCount: sql<number>`count(distinct ${postComments.id})::int`,
        totalEngagement: sql<number>`(count(distinct ${posts.id}) + count(distinct ${postComments.id}))::int`,
      })
      .from(users)
      .leftJoin(posts, and(eq(users.id, posts.userId), gte(posts.createdAt, startDate)))
      .leftJoin(postComments, and(eq(users.id, postComments.userId), gte(postComments.createdAt, startDate)))
      .groupBy(users.id, users.username)
      .orderBy(desc(sql<number>`count(distinct ${posts.id}) + count(distinct ${postComments.id})`))
      .limit(5);

    // Get user growth over time
    const userGrowth = await db
      .select({
        month: sql<string>`to_char(created_at, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(gte(users.createdAt, sql`now() - interval '12 months'`))
      .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
      .orderBy(sql`to_char(created_at, 'YYYY-MM')`);

    // Get daily activity trends
    const activityTrends = await db
      .select({
        date: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
        logins: sql<number>`count(*) filter (where activity_type = 'login')::int`,
        posts: sql<number>`count(*) filter (where activity_type = 'post_created')::int`,
        comments: sql<number>`count(*) filter (where activity_type = 'comment_created')::int`,
      })
      .from(userActivity)
      .where(gte(userActivity.createdAt, startDate))
      .groupBy(sql`to_char(created_at, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(created_at, 'YYYY-MM-DD')`);

    // Get user retention data
    const [retentionData] = await db
      .select({
        totalUsers: sql<number>`count(distinct user_id)::int`,
        returnedUsers: sql<number>`count(distinct user_id) filter (where exists (
          select 1 from user_activity ua2 
          where ua2.user_id = user_activity.user_id 
          and ua2.created_at > user_activity.created_at + interval '1 day'
          and ua2.created_at <= user_activity.created_at + interval '${sql.raw(timeRange.toString())} days'
        ))::int`,
      })
      .from(userActivity)
      .where(and(
        eq(userActivity.activityType, 'login'),
        gte(userActivity.createdAt, startDate)
      ));

    const retentionRate = retentionData.totalUsers > 0
      ? Number(((retentionData.returnedUsers / retentionData.totalUsers) * 100).toFixed(1))
      : 0;

    return {
      overview: {
        totalUsers,
        dailyActiveUsers,
        monthlyActiveUsers,
        premiumUsers,
        conversionRate,
      },
      topContributors: {
        jobPosters,
        engagedUsers,
      },
      trends: {
        userGrowth,
        activityTrends,
      },
      retention: {
        totalUsers: retentionData.totalUsers,
        returnedUsers: retentionData.returnedUsers,
        retentionRate,
      },
    };
  } catch (error) {
    console.error("Error getting analytics:", error);
    throw error;
  }
} 