import { Request, Response } from 'express';
import { User, highlights } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';

// GET /api/highlights
export const getHighlights = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as User).id;

        const userHighlights = await db
            .select()
            .from(highlights)
            .where(eq(highlights.userId, userId));

        res.status(200).json(userHighlights);
    } catch (error) {
        console.error('Error fetching highlights:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /api/highlights
export const createHighlight = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as User).id;
        const { title, type, description, url } = req.body;
        const file = req.file; // Assuming you're using multer for file upload

        if (!title || !type || (!file && !url)) {
            return res.status(400).json({ error: 'Title, type and file or url are required' });
        }

        // Handle file upload (assuming you have a file upload service)
        const fileUrl = req.file && `/uploads/documents/${req.file.filename}`; // Implement your file upload logic
        // Create highlight record
        const newHighlight = await db
            .insert(highlights)
            .values({
                userId,
                title,
                type,
                description: description || null,
                fileUrl,
                url,
                createdAt: new Date(),
            })
            .returning();

        res.status(201).json(newHighlight[0]);
    } catch (error) {
        console.error('Error creating highlight:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// DELETE /api/highlights/:id
export const deleteHighlight = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req.user as User).id;
        // Delete the specific highlight where both id and userId match
        const result = await db
            .delete(highlights)
            .where(
                and(
                    eq(highlights.id, id),
                    eq(highlights.userId, userId)
                )
            )
            .returning();

        if (!result.length) {
            return res.status(404).json({ error: 'Highlight not found or unauthorized' });
        }

        res.status(200).json({ message: 'Highlight deleted successfully' });
    } catch (error) {
        console.error('Error deleting highlight:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};