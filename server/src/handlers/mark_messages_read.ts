import { db } from '../db';
import { messagesTable, conversationsTable } from '../db/schema';
import { eq, and, ne } from 'drizzle-orm';

export const markMessagesRead = async (conversationId: number, userId: number): Promise<void> => {
  try {
    // First, validate the user has access to this conversation
    const conversation = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .execute();

    if (conversation.length === 0) {
      throw new Error('Conversation not found');
    }

    const conv = conversation[0];
    
    // Check if user is part of this conversation
    if (conv.user1_id !== userId && conv.user2_id !== userId) {
      throw new Error('User does not have access to this conversation');
    }

    // Update all unread messages in the conversation where sender is NOT the current user
    await db.update(messagesTable)
      .set({ is_read: true })
      .where(
        and(
          eq(messagesTable.conversation_id, conversationId),
          ne(messagesTable.sender_id, userId),
          eq(messagesTable.is_read, false)
        )
      )
      .execute();

  } catch (error) {
    console.error('Mark messages read failed:', error);
    throw error;
  }
};