import type * as schema from "@/db/schema";

import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import {
  jobApplications,
  jobs,
  networkConnections,
  profiles,
  users,
} from "@/db/schema";

import type { DrizzleTypeError } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { db } from "@/db";
import { env } from "../config/env";
import schedule from "node-schedule";
import { sendEmail } from "../helpers/email-sender";

const typedDb = db as NeonDatabase<typeof schema>;

interface JobWithCompany {
  id: number;
  title: string;
  type: "full_time" | "part_time" | "internship" | "contract";
  companyName: string | null;
}

interface ApplicationWithDetails {
  status: "pending" | "reviewed" | "interviewing" | "accepted" | "rejected";
  jobTitle: string;
  companyName: string | null;
}

interface CandidateProfile {
  name: string | null;
  university: string | null;
  skills: string[] | null;
  userId: number;
}

interface JobSummary {
  title: string;
  company: string;
  type: string;
}

interface ApplicationSummary {
  title: string;
  company: string;
  status: string;
}

interface CandidateSummary {
  name: string;
  school: string;
  skills: string;
  profile_url: string;
}

interface JobPostingSummary {
  title: string;
  applications: string;
}

// Profile completion reminder: Daily at 10 AM
const scheduleProfileCompletionReminders = () => {
  console.log("Scheduling profile completion reminder for daily at 10 AM");

  const job = schedule.scheduleJob(
    "Profile Completion Reminder",
    "0 10 * * *",
    async () => {
      try {
        console.log("Running profile completion reminder job...");

        // Get users with incomplete profiles
        const usersWithIncompleteProfiles = await typedDb
          .select({
            id: users.id,
            email: users.email,
            username: users.username,
            role: users.role,
          })
          .from(users)
          .leftJoin(profiles, eq(users.id, profiles.userId))
          .where(
            and(
              eq(users.status, "approved"),
              eq(users.hasCompletedOnboarding, false),
              or(
                sql`${profiles.id} IS NULL`,
                sql`${profiles.bio} IS NULL OR ${profiles.bio} = ''`,
                sql`${profiles.skills} IS NULL OR array_length(${profiles.skills}, 1) IS NULL`
              )
            )
          );
        // Send reminder emails
        for (const user of usersWithIncompleteProfiles) {
          await sendEmail({
            to: user.email,
            campaignId: env.PROFILE_COMPLETION_REMINDER_CAMPAIGN_ID,
            campaignData: {
              first_name: user.username,
              roleIntroContent:
                user.role === "student"
                  ? "– Highlight your skills, past experience, and what you're looking for so top startups & VCs know exactly how you can add value."
                  : " – Showcase your funding rounds, deal flow, and hiring needs so the right people can find you. Whether you're actively fundraising, deploying capital, or just looking for the right connections.",
              id: user.id.toString(),
              profile_url: `${process.env.CLIENT_BASE_URL}/dashboard`,
            },
            templateData: {}, // Required by EmailData type
          });
        }

        console.log(
          `Sent ${usersWithIncompleteProfiles.length} profile completion reminders`
        );
      } catch (error) {
        console.error("Error in profile completion reminder job:", error);
      }
    }
  );
  return job;
};

// Student weekly summary: Run every Sunday at 7 PM
const scheduleStudentWeeklySummary = () => {
  const job = schedule.scheduleJob(
    "Student Weekly Summary",
    "0 19 * * 0",
    // new Date(Date.now() + 60000), // Run after 1 minute
    async () => {
      console.log("Running student weekly summary job...");
      
      let successCount = 0;
      let failureCount = 0;
      let unsubscribedCount = 0;

      try {
        // Get last week's date range
        const today = new Date();
        const lastWeekStart = new Date(today.setDate(today.getDate() - 7));
        lastWeekStart.setHours(0, 0, 0, 0);
        const lastWeekEnd = new Date();
        lastWeekEnd.setHours(23, 59, 59, 999);

        // Get all students from last week
        const students = await typedDb
          .select({
            id: users.id,
            email: users.email,
            name: profiles.name,
            username: users.username,
          })
          .from(users)
          .leftJoin(profiles, eq(users.id, profiles.userId))
          .where(eq(users.role, "student"));
          
        console.log(`Found ${students.length} students to send emails to`);

        for (const student of students) {
          try {
            // Skip if testing with specific email
            
            console.log('Processing student:', student.email);
            
            // Get new connection requests count from last week
            const [{ count: newRequestsCount }] = await typedDb
              .select({ count: sql<number>`count(*)` })
              .from(networkConnections)
              .where(
                and(
                  eq(networkConnections.toUserId, student.id),
                  eq(networkConnections.type, "pending"),
                  gte(networkConnections.createdAt, lastWeekStart),
                  lte(networkConnections.createdAt, lastWeekEnd)
                )
              );

            // Get new jobs posted in the last week
            const newJobs = await typedDb
              .select({
                title: jobs.title,
                type: jobs.type,
                companyName: profiles.name,
              })
              .from(jobs)
              .innerJoin(users, eq(jobs.userId, users.id))
              .leftJoin(profiles, eq(users.id, profiles.userId))
              .where(
                and(
                  gte(jobs.createdAt, lastWeekStart),
                  lte(jobs.createdAt, lastWeekEnd)
                )
              )
              .orderBy(desc(jobs.createdAt))
              .limit(3);

            // Format jobs list in HTML with unordered list
            const jobsListHtml = newJobs.length > 0
              ? `<ul>
                  ${newJobs
                    .map(job => {
                      const jobType = job.type === "internship" 
                        ? "Internship"
                        : job.type === "contract" 
                          ? "Summer" 
                          : "Full-Time";
                      return `<li>
                        <strong>${job.title}</strong> at 
                        <strong>${job.companyName || "Company"}</strong>
                        <span>(${jobType})</span>
                      </li>`;
                    })
                    .join("")}
                </ul>`
              : "<p><strong>No new jobs this week</strong></p>";

            const emailResult = await sendEmail({
              to: student.email,
              campaignId: env.STUDENT_WEEKLY_SUMMARY_CAMPAIGN_ID,
              campaignData: {
                first_name: student.name || student.username,
                new_requests_count: newRequestsCount.toString(),
                new_job_opportunities: jobsListHtml,
                open_roles_link: `${env.CLIENT_BASE_URL}/jobs`,
                dashboard_link: `${env.CLIENT_BASE_URL}/dashboard`,
              },
              templateData: {}, // Required by EmailData type
            });

            if (emailResult.success) {
              successCount++;
              console.log(`✅ Email sent successfully to ${student.email}`);
            } else {
              if (emailResult.isUnsubscribed) {
                unsubscribedCount++;
                console.log(`📧 User ${student.email} is unsubscribed`);
              } else {
                failureCount++;
                console.error(`❌ Failed to send email to ${student.email}: ${emailResult.error}`);
              }
            }
          } catch (studentError) {
            failureCount++;
            console.error(`❌ Error processing student ${student.email}:`, studentError);
          }
        }

        console.log(`📊 Student weekly summary completed:`);
        console.log(`   ✅ Success: ${successCount}`);
        console.log(`   ❌ Failed: ${failureCount}`);
        console.log(`   📧 Unsubscribed: ${unsubscribedCount}`);
        console.log(`   📋 Total processed: ${successCount + failureCount + unsubscribedCount}`);
        
      } catch (error) {
        console.error("❌ Critical error in student weekly summary job:", error);
      }
    }
  );
  return job;
};

// Business weekly summary: Run every Sunday at 7 PM
const scheduleBusinessWeeklySummary = () => {
  const job = schedule.scheduleJob(
    "Business Weekly Summary",
    "0 19 * * 0",
    // new Date(Date.now() + 60000),
    async () => {
      console.log("Running business weekly summary job...");
      
      let successCount = 0;
      let failureCount = 0;
      let unsubscribedCount = 0;

      try {
        // Get last week's date range
        const today = new Date();
        const lastWeekStart = new Date(today.setDate(today.getDate() - 7));
        lastWeekStart.setHours(0, 0, 0, 0);
        const lastWeekEnd = new Date();
        lastWeekEnd.setHours(23, 59, 59, 999);

        // Get all businesses from last week
        const businesses = await typedDb
          .select({
            id: users.id,
            email: users.email,
            name: profiles.name,
            username: users.username,
            role: users.role,
          })
          .from(users)
          .leftJoin(profiles, eq(users.id, profiles.userId))
          .where(
            or(eq(users.role, "venture_capitalist"), eq(users.role, "startup"))
          );
          
        console.log(`Found ${businesses.length} businesses to send emails to`);

        for (const business of businesses) {
          try {
            console.log('Processing business:', business.email);
            
            // Get new connection requests count from last week
            const [{ count: newRequestsCount }] = await typedDb
              .select({ count: sql<number>`count(*)` })
              .from(networkConnections)
              .where(
                and(
                  eq(networkConnections.toUserId, business.id),
                  eq(networkConnections.type, "pending"),
                  gte(networkConnections.createdAt, lastWeekStart),
                  lte(networkConnections.createdAt, lastWeekEnd)
                )
              );

            // Get jobs posted last week with application counts
            const jobsWithApplications = await typedDb
              .select({
                jobId: jobs.id,
                title: jobs.title,
                applicantCount: sql<number>`count(${jobApplications.id})`,
              })
              .from(jobs)
              .leftJoin(
                jobApplications,
                and(
                  eq(jobs.id, jobApplications.jobId),
                  gte(jobApplications.createdAt, lastWeekStart),
                  lte(jobApplications.createdAt, lastWeekEnd)
                )
              )
              .where(
                and(
                  eq(jobs.userId, business.id),
                  gte(jobs.createdAt, lastWeekStart),
                  lte(jobs.createdAt, lastWeekEnd)
                )
              )
              .groupBy(jobs.id, jobs.title)
              .orderBy(desc(jobs.createdAt));

            // Format jobs list in HTML
            const jobPostingsHtml = jobsWithApplications.length > 0
              ? `<ul>
                  ${jobsWithApplications
                    .map(job => 
                      `<li>
                        <strong>${job.title}</strong> – 
                        <strong>${job.applicantCount}</strong> new applicants
                      </li>`
                    )
                    .join("")}
                </ul>`
              : "<p><strong>No new job postings this week</strong></p>";

            // Get new candidates who applied last week
            const newCandidates = await typedDb
              .select({
                name: profiles.name,
                university: profiles.university,
                skills: profiles.skills,
                userId: profiles.userId,
              })
              .from(jobApplications)
              .innerJoin(jobs, eq(jobApplications.jobId, jobs.id))
              .innerJoin(users, eq(jobApplications.userId, users.id))
              .innerJoin(profiles, eq(users.id, profiles.userId))
              .where(
                and(
                  eq(jobs.userId, business.id),
                  gte(jobApplications.createdAt, lastWeekStart),
                  lte(jobApplications.createdAt, lastWeekEnd)
                )
              )
              .orderBy(desc(jobApplications.createdAt));

            // Format candidates list in HTML
            const newCandidatesHtml = newCandidates.length > 0
              ? `<ul>
                  ${newCandidates
                    .map(candidate => {
                      const skillsSummary = (candidate.skills || [])
                        .slice(0, 3)
                        .join(", ") + 
                        (candidate?.skills?.length > 3 ? "..." : "");
                      return `<li>
                        <strong>${candidate.name || "Anonymous"}</strong> – 
                        <strong>${candidate.university || "N/A"}</strong>
                        <br/>
                        <span>Skills: ${skillsSummary}</span>
                        <br/>
                        <a href="${env.CLIENT_BASE_URL}/profile/${candidate.userId}">
                          View Profile →
                        </a>
                      </li>`;
                    })
                    .join("")}
                </ul>`
              : "<p><strong>No new candidates this week</strong></p>";

            const emailResult = await sendEmail({
              to: business.email,
              campaignId: env.BUSINESS_WEEKLY_SUMMARY_CAMPAIGN_ID,
              campaignData: {
                first_name: business.name || business.username,
                new_requests_count_in_week: newRequestsCount.toString(),
                job_postings: jobPostingsHtml,
                new_candidates: newCandidatesHtml,
                open_roles_link: `${env.CLIENT_BASE_URL}/hire`,
                review_link: `${env.CLIENT_BASE_URL}/hire`,
                highlights_link: `${env.CLIENT_BASE_URL}/highlights`,
                dashboard_link: `${env.CLIENT_BASE_URL}/dashboard`,
              },
              templateData: {}, // Required by EmailData type
            });

            if (emailResult.success) {
              successCount++;
              console.log(`✅ Email sent successfully to ${business.email}`);
            } else {
              if (emailResult.isUnsubscribed) {
                unsubscribedCount++;
                console.log(`📧 User ${business.email} is unsubscribed`);
              } else {
                failureCount++;
                console.error(`❌ Failed to send email to ${business.email}: ${emailResult.error}`);
              }
            }
          } catch (businessError) {
            failureCount++;
            console.error(`❌ Error processing business ${business.email}:`, businessError);
          }
        }

        console.log(`📊 Business weekly summary completed:`);
        console.log(`   ✅ Success: ${successCount}`);
        console.log(`   ❌ Failed: ${failureCount}`);
        console.log(`   📧 Unsubscribed: ${unsubscribedCount}`);
        console.log(`   📋 Total processed: ${successCount + failureCount + unsubscribedCount}`);
        
      } catch (error) {
        console.error("❌ Critical error in business weekly summary job:", error);
      }
    }
  );
  return job;
};

// Initialize all cron jobs
export const initCronJobs = () => {
  const jobs = [
    scheduleProfileCompletionReminders(),
    scheduleStudentWeeklySummary(),
    scheduleBusinessWeeklySummary(),
  ];

  console.log("Scheduled jobs initialized:");
  jobs.forEach((job) => {
    if (job.name) {
      console.log(
        `- ${job.name}: Next run at ${job.nextInvocation().toLocaleString()}`
      );
    }
  });

  return jobs;
};
