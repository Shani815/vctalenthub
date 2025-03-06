import { Request, Response } from "express";
import { User, profiles } from "@/db/schema";

import { db } from "@/db";
import { eq } from "drizzle-orm";

export const createStudentProfile = async (req: Request, res: Response) => {
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
            skills = req.body.skills.map(s => {
              if (typeof s === 'string') {
                // Try to parse if it's a JSON string
                try {
                  let parsed = s;
                  while (typeof parsed === 'string') {
                    try {
                      parsed = JSON.parse(parsed);
                    } catch {
                      break;
                    }
                  }
                  return typeof parsed === 'string' ? parsed : String(parsed);
                } catch {
                  return s;
                }
              }
              return String(s);
            });
          } else if (typeof req.body.skills === 'string') {
            try {
              // Try to parse if it's a JSON string
              let parsed = req.body.skills;
              while (typeof parsed === 'string') {
                try {
                  parsed = JSON.parse(parsed);
                } catch {
                  break;
                }
              }
              skills = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
            } catch {
              // If parsing fails, split by comma
              skills = req.body.skills.split(',').map(s => s.trim()).filter(Boolean);
            }
          }
        }
  
        const profileData = {
          ...req.body,
          skills: skills,
          avatarUrl: req.file ? `/uploads/avatars/${req.file.filename}` : existing?.avatarUrl
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
        console.error('Profile update error:', error);
        res.status(500).json({
          message: "Failed to update profile",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
};
