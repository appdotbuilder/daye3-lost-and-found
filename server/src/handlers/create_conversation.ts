import { db } from '../db';
import { conversationsTable, postsTable, usersTable } from '../db/schema';
import { type CreateConversationInput, type Conversation } from '../schema';
import { eq, and, or } from 'drizzle-orm';

export const createConversation = async (input: CreateConversationInput): Promise<Conversation> => {
  try {
    // 1. Validate that the post exists
    const post = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, input.post_id))
      .execute();

    if (post.length === 0) {
      throw new Error(`Post with id ${input.post_id} not found`);
    }

    // 2. Validate that both users exist
    const users = await db.select()
      .from(usersTable)
      .where(or(
        eq(usersTable.id, input.user1_id),
        eq(usersTable.id, input.user2_id)
      ))
      .execute();

    if (users.length !== 2) {
      const foundUserIds = users.map(u => u.id);
      const missingUserIds = [input.user1_id, input.user2_id].filter(id => !foundUserIds.includes(id));
      throw new Error(`Users with ids ${missingUserIds.join(', ')} not found`);
    }

    // 3. Check if a conversation already exists between these users for this post
    const existingConversation = await db.select()
      .from(conversationsTable)
      .where(and(
        eq(conversationsTable.post_id, input.post_id),
        or(
          and(
            eq(conversationsTable.user1_id, input.user1_id),
            eq(conversationsTable.user2_id, input.user2_id)
          ),
          and(
            eq(conversationsTable.user1_id, input.user2_id),
            eq(conversationsTable.user2_id, input.user1_id)
          )
        )
      ))
      .execute();

    if (existingConversation.length > 0) {
      return existingConversation[0];
    }

    // 4. Create a new conversation record
    const result = await db.insert(conversationsTable)
      .values({
        post_id: input.post_id,
        user1_id: input.user1_id,
        user2_id: input.user2_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Conversation creation failed:', error);
    throw error;
  }
};