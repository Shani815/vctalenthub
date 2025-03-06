import { Request, Response } from "express";
import { User, profiles, users } from "@/db/schema";
import { eq, like, or, sql } from "drizzle-orm";

import { db } from "@/db";

const roles={
    all:"",
    student:"student",
    vc:"venture_capitalist",
    company:"startup"
}

// GET /api/admin/users
export const getUsers = async (req: Request, res: Response) => {
    try {
        if (!req.isAuthenticated() || (req.user as User).role !== 'admin') {
            return res.status(403).json({ message: "Unauthorized access" });
          }
        const { page = 1, search = "", role : searchedRole="all",limit:pageLimit="10" } = req.query;
        const role = roles[searchedRole as keyof typeof roles];
        const limit =parseInt(pageLimit as string)
        const offset = (Number(page) - 1) * limit ;
        
        // Build the base query
        let query = db
            .select({
                ...users,
                // Join with profiles to get profile data
                profile: profiles
            })
            .from(users)
            .leftJoin(profiles, eq(users.id, profiles.userId))
            .limit(limit)
            .offset(offset);

        // Add search condition if search parameter exists
        if (search) {
            query = query.where(
                or(
                    like(users.username, `%${search}%`),
                    like(profiles.name, `%${search}%`),
                    like(users.email, `%${search}%`)
                )
            );
        }

        // Add role filter if role parameter exists
        if (role && role !== 'all') {
            query = query.where(eq(users.role, role));
        }

        // Get total count for pagination
        const totalQuery = db
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(role ? eq(users.role, role) : undefined);

        // Execute both queries in parallel
        const [usersData, [{ count }]] = await Promise.all([
            query,
            totalQuery
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(count / limit);

        res.status(200).json({
            users:usersData,
            pagination: {
                total: count,
                pages: totalPages,
                currentPage: Number(page),
                perPage: limit
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};