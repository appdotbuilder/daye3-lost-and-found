import { db } from '../db';
import { conversationsTable, messagesTable } from '../db/schema';
import { type Message } from '../schema';
import { eq, desc, and } from 'drizzle-orm';

export const getConversationMessages = async (
    conversationId: number, 
    userId: number, 
    limit: number = 50, 
    offset: number = 0
): Promise<Message[]> => {
    try {
        // First, verify that the user has access to this conversation
        const conversation = await db.select()
            .from(conversationsTable)
            .where(eq(conversationsTable.id, conversationId))
            .execute();

        if (conversation.length === 0) {
            throw new Error('Conversation not found');
        }

        const conv = conversation[0];
        if (conv.user1_id !== userId && conv.user2_id !== userId) {
            throw new Error('Access denied: User is not part of this conversation');
        }

        // Query messages for the conversation with pagination
        const messages = await db.select()
            .from(messagesTable)
            .where(eq(messagesTable.conversation_id, conversationId))
            .orderBy(desc(messagesTable.created_at))
            .limit(limit)
            .offset(offset)
            .execute();

        // Mark unread messages as read for the current user (recipient)
        const unreadMessageIds = messages
            .filter(msg => msg.sender_id !== userId && !msg.is_read)
            .map(msg => msg.id);

        if (unreadMessageIds.length > 0) {
            await db.update(messagesTable)
                .set({ is_read: true })
                .where(and(
                    eq(messagesTable.conversation_id, conversationId),
                    eq(messagesTable.is_read, false)
                ))
                .execute();

            // Update the messages array to reflect the read status
            messages.forEach(msg => {
                if (msg.sender_id !== userId) {
                    msg.is_read = true;
                }
            });
        }

        return messages;
    } catch (error) {
        console.error('Failed to get conversation messages:', error);
        throw error;
    }
};