import { db } from '../db';
import { messagesTable, conversationsTable } from '../db/schema';
import { type SendMessageInput, type Message } from '../schema';
import { eq, or, and } from 'drizzle-orm';

export const sendMessage = async (input: SendMessageInput): Promise<Message> => {
  try {
    // First, validate that the conversation exists and sender has access to it
    const conversations = await db.select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, input.conversation_id),
          or(
            eq(conversationsTable.user1_id, input.sender_id),
            eq(conversationsTable.user2_id, input.sender_id)
          )
        )
      )
      .execute();

    if (conversations.length === 0) {
      throw new Error('Conversation not found or sender does not have access to this conversation');
    }

    // Create the new message record
    const messageResult = await db.insert(messagesTable)
      .values({
        conversation_id: input.conversation_id,
        sender_id: input.sender_id,
        content: input.content,
        is_read: false
      })
      .returning()
      .execute();

    const newMessage = messageResult[0];

    // Update the conversation's last_message_at timestamp
    await db.update(conversationsTable)
      .set({
        last_message_at: new Date()
      })
      .where(eq(conversationsTable.id, input.conversation_id))
      .execute();

    // Note: Real-time message delivery (WebSocket/Server-Sent Events) would be implemented
    // at the API layer, not in the handler

    return newMessage;
  } catch (error) {
    console.error('Send message failed:', error);
    throw error;
  }
};