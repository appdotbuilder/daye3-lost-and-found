import { db } from '../db';
import { conversationsTable, messagesTable, postsTable, usersTable } from '../db/schema';
import { type ConversationWithMessages } from '../schema';
import { eq, or, desc, asc } from 'drizzle-orm';

export const getConversations = async (userId: number): Promise<ConversationWithMessages[]> => {
  try {
    // Query conversations where user is either user1 or user2
    const results = await db.select()
      .from(conversationsTable)
      .innerJoin(postsTable, eq(conversationsTable.post_id, postsTable.id))
      .leftJoin(messagesTable, eq(conversationsTable.id, messagesTable.conversation_id))
      .leftJoin(usersTable, or(
        eq(conversationsTable.user1_id, usersTable.id),
        eq(conversationsTable.user2_id, usersTable.id)
      ))
      .where(or(
        eq(conversationsTable.user1_id, userId),
        eq(conversationsTable.user2_id, userId)
      ))
      .orderBy(desc(conversationsTable.last_message_at), asc(messagesTable.created_at))
      .execute();

    // Group results by conversation and build the response structure
    const conversationMap = new Map<number, ConversationWithMessages>();

    for (const result of results) {
      const conversationId = result.conversations.id;
      
      if (!conversationMap.has(conversationId)) {
        // Determine the other user (not the current user)
        const isUser1 = result.conversations.user1_id === userId;
        const otherUserId = isUser1 ? result.conversations.user2_id : result.conversations.user1_id;
        
        // Get the other user's details
        const otherUserResult = await db.select({
          id: usersTable.id,
          first_name: usersTable.first_name,
          last_name: usersTable.last_name
        })
        .from(usersTable)
        .where(eq(usersTable.id, otherUserId))
        .execute();

        const otherUser = otherUserResult[0];

        conversationMap.set(conversationId, {
          id: result.conversations.id,
          post_id: result.conversations.post_id,
          user1_id: result.conversations.user1_id,
          user2_id: result.conversations.user2_id,
          last_message_at: result.conversations.last_message_at,
          created_at: result.conversations.created_at,
          messages: [],
          post: {
            id: result.posts.id,
            title: result.posts.title,
            type: result.posts.type
          },
          other_user: {
            id: otherUser.id,
            first_name: otherUser.first_name,
            last_name: otherUser.last_name
          }
        });
      }

      // Add message if it exists
      if (result.messages) {
        const conversation = conversationMap.get(conversationId)!;
        
        // Check if this message is already added (due to multiple joins)
        const messageExists = conversation.messages.some(msg => msg.id === result.messages!.id);
        
        if (!messageExists) {
          conversation.messages.push({
            id: result.messages.id,
            conversation_id: result.messages.conversation_id,
            sender_id: result.messages.sender_id,
            content: result.messages.content,
            is_read: result.messages.is_read,
            created_at: result.messages.created_at
          });
        }
      }
    }

    // Convert map to array and sort by last_message_at descending
    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => b.last_message_at.getTime() - a.last_message_at.getTime());

    // Sort messages within each conversation by created_at ascending (oldest first)
    conversations.forEach(conversation => {
      conversation.messages.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    });

    return conversations;
  } catch (error) {
    console.error('Get conversations failed:', error);
    throw error;
  }
};