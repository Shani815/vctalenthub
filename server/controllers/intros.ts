// controllers/intros.ts

import { Request, Response } from 'express';
import { User, intros, profiles, users } from '@/db/schema';
import { and, eq, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { sendEmail } from 'server/helpers/email-sender';

// POST /api/intros/request
export const createIntroRequest = async (req: Request, res: Response) => {
    try {
        const { targetId, requesterId } = req.body;

        if (!targetId || !requesterId) {
            return res.status(400).json({ error: 'Target and requester IDs are required' });
        }

        // Get requester's user data (includes role and tier)
        const [requester] = await db
            .select()
            .from(users)
            .where(eq(users.id, requesterId))
            .limit(1);

        // Get target user's data
        const [targetUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, targetId))
            .limit(1);

        if (!requester || !targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if student with free tier
        if (requester.role === 'student' && requester.tier === 'free') {
            return res.status(403).send("This is a premium feature. Please upgrade your account to connect with other VCs and Startups.");
        }

        // Check if both users are VCs or Startups
        if (
            (requester.role === 'venture_capitalist' || requester.role === 'startup') &&
            (targetUser.role === 'venture_capitalist' || targetUser.role === 'startup')
        ) {
            return res.status(403).send("This is a premium feature. Please upgrade your account to connect with other VCs and Startups.");
        }

        // Check for existing request
        const existingRequest = await db
            .select()
            .from(intros)
            .where(
                or(
                    and(eq(intros.targetId, targetId), eq(intros.requesterId, requesterId), eq(intros.status, "pending")),
                    and(eq(intros.targetId, requesterId), eq(intros.requesterId, targetId), eq(intros.status, "pending"))
                )
            )
            .limit(1);

        if (existingRequest.length > 0) {
            return res.status(409).send("Request already sent");
        }

        // Create the intro request
        await db.transaction(async (trx) => {
            const updated = await trx.execute(sql`
              UPDATE intros 
              SET status = 'pending'
              WHERE target_id = ${targetId} AND requester_id = ${requesterId}
              RETURNING id;
            `);
          
            if (updated.length === 0) {
              await trx.execute(sql`
                INSERT INTO intros (target_id, requester_id, status)
                VALUES (${targetId}, ${requesterId}, 'pending');
              `);
            }
          })

        res.status(201).json({ message: 'Request created successfully' });
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /api/intros/pending
export const getPendingIntros = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as User).id;
        const pendingIntros = await db
            .select({
                id: intros.id,
                profile: { name: profiles.name ?? "", avatarUrl: profiles.avatarUrl ?? "",id:profiles.userId ?? ""},
            })
            .from(intros)
            .leftJoin(profiles, eq(intros.requesterId, profiles.userId))
            .where(
                and(
                    eq(intros.status, "pending"),
                    eq(intros.targetId, userId)
                )
            );

        res.status(200).json(pendingIntros);
    } catch (error) {
        console.error('Error fetching pending requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /api/intros/respond
export const respondToIntroRequest = async (req: Request, res: Response) => {
    try {
        const { id, status } = req.body;

        if (!id || !status) {
            return res.status(400).json({ error: 'ID and status are required' });
        }
        await db.update(intros).set({ status }).where(eq(intros.id, id));
        
        const [intro] = await db
        .select()
        .from(intros)
        .where(eq(intros.id, id))
        .limit(1);

        if (status === 'rejected') {
            return res.status(200).json({ message: 'Request rejected successfully' });
        }

        if (!intro) {
            return res.status(404).json({ error: 'Intro not found' });
        }

        const getCompleteProfile = async (userId:number) => {
            const result = await db
                .select({
                    ...profiles,
                    email: users.email,
                    role: users.role
                })
                .from(profiles)
                .innerJoin(users, eq(profiles.userId, users.id))
                .where(eq(profiles.userId, userId))
                .limit(1);
        
            return result[0] || null;
        };

        const [targetProfile, requesterProfile] = await Promise.all([
            getCompleteProfile(intro.targetId),
            getCompleteProfile(intro.requesterId)
        ])

        if (!targetProfile || !requesterProfile) {
            return res.status(404).json({ error: 'User profiles not found' });
        }

        const user1 = targetProfile;
        const user2 = requesterProfile;

        await Promise.all([user1.email, user2.email].map((email) =>
            sendEmail({
                to: email,
                campaignId: process.env.MAILMODO_INTRO_CAMPAIGN_ID,
                campaignData: {
                    user1_name: user1.name ?? "",
                    user2_name: user2.name ?? "",
                    user1_url: `${process.env.CLIENT_BASE_URL}/profile/${user1.userId}`,
                    user2_url: `${process.env.CLIENT_BASE_URL}/profile/${user2.userId}`,
                    user1_intro: user1.bio ?? "",
                    user2_intro: user2.bio ?? "",
                }
            })
        ));

        res.status(200).json({ message: 'Request accepted and email sent successfully' });
    } catch (error) {
        console.error('Error updating status or sending email:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// .7_ukwX6_nCDiXT
// benosec857@owlny.com