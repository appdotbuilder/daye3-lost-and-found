import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, conversationsTable, messagesTable } from '../db/schema';
import { markMessagesRead } from '../handlers/mark_messages_read';
import { eq, and } from 'drizzle-orm';

describe('markMessagesRead', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should mark messages as read for valid user', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@test.com',
          password_hash: 'hash1',
          first_name: 'User',
          last_name: 'One',
          preferred_language: 'en'
        },
        {
          email: 'user2@test.com',
          password_hash: 'hash2',
          first_name: 'User',
          last_name: 'Two',
          preferred_language: 'en'
        }
      ])
      .returning()
      .execute();

    // Create test post
    const post = await db.insert(postsTable)
      .values({
        user_id: users[0].id,
        title: 'Test Post',
        description: 'Test Description',
        type: 'lost',
        category: 'electronics',
        contact_info: 'test@example.com'
      })
      .returning()
      .execute();

    // Create conversation
    const conversation = await db.insert(conversationsTable)
      .values({
        post_id: post[0].id,
        user1_id: users[0].id,
        user2_id: users[1].id
      })
      .returning()
      .execute();

    // Create test messages - some from each user, all unread
    await db.insert(messagesTable)
      .values([
        {
          conversation_id: conversation[0].id,
          sender_id: users[0].id,
          content: 'Message from user 1',
          is_read: false
        },
        {
          conversation_id: conversation[0].id,
          sender_id: users[1].id,
          content: 'Message from user 2',
          is_read: false
        },
        {
          conversation_id: conversation[0].id,
          sender_id: users[1].id,
          content: 'Another message from user 2',
          is_read: false
        }
      ])
      .execute();

    // Mark messages as read for user 1 (should mark messages from user 2 as read)
    await markMessagesRead(conversation[0].id, users[0].id);

    // Verify messages from user 2 are marked as read
    const messagesFromUser2 = await db.select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.conversation_id, conversation[0].id),
          eq(messagesTable.sender_id, users[1].id)
        )
      )
      .execute();

    messagesFromUser2.forEach(message => {
      expect(message.is_read).toBe(true);
    });

    // Verify message from user 1 remains unread (user doesn't mark their own messages as read)
    const messagesFromUser1 = await db.select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.conversation_id, conversation[0].id),
          eq(messagesTable.sender_id, users[0].id)
        )
      )
      .execute();

    messagesFromUser1.forEach(message => {
      expect(message.is_read).toBe(false);
    });
  });

  it('should only mark unread messages as read', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@test.com',
          password_hash: 'hash1',
          first_name: 'User',
          last_name: 'One',
          preferred_language: 'en'
        },
        {
          email: 'user2@test.com',
          password_hash: 'hash2',
          first_name: 'User',
          last_name: 'Two',
          preferred_language: 'en'
        }
      ])
      .returning()
      .execute();

    // Create test post
    const post = await db.insert(postsTable)
      .values({
        user_id: users[0].id,
        title: 'Test Post',
        description: 'Test Description',
        type: 'lost',
        category: 'electronics',
        contact_info: 'test@example.com'
      })
      .returning()
      .execute();

    // Create conversation
    const conversation = await db.insert(conversationsTable)
      .values({
        post_id: post[0].id,
        user1_id: users[0].id,
        user2_id: users[1].id
      })
      .returning()
      .execute();

    // Create messages with mixed read status
    await db.insert(messagesTable)
      .values([
        {
          conversation_id: conversation[0].id,
          sender_id: users[1].id,
          content: 'Already read message',
          is_read: true
        },
        {
          conversation_id: conversation[0].id,
          sender_id: users[1].id,
          content: 'Unread message',
          is_read: false
        }
      ])
      .execute();

    // Mark messages as read
    await markMessagesRead(conversation[0].id, users[0].id);

    // Verify all messages from user 2 are now read
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.conversation_id, conversation[0].id))
      .execute();

    expect(messages).toHaveLength(2);
    messages.forEach(message => {
      expect(message.is_read).toBe(true);
    });
  });

  it('should throw error for non-existent conversation', async () => {
    await expect(markMessagesRead(999, 1)).rejects.toThrow(/conversation not found/i);
  });

  it('should throw error when user does not have access to conversation', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@test.com',
          password_hash: 'hash1',
          first_name: 'User',
          last_name: 'One',
          preferred_language: 'en'
        },
        {
          email: 'user2@test.com',
          password_hash: 'hash2',
          first_name: 'User',
          last_name: 'Two',
          preferred_language: 'en'
        },
        {
          email: 'user3@test.com',
          password_hash: 'hash3',
          first_name: 'User',
          last_name: 'Three',
          preferred_language: 'en'
        }
      ])
      .returning()
      .execute();

    // Create test post
    const post = await db.insert(postsTable)
      .values({
        user_id: users[0].id,
        title: 'Test Post',
        description: 'Test Description',
        type: 'lost',
        category: 'electronics',
        contact_info: 'test@example.com'
      })
      .returning()
      .execute();

    // Create conversation between user 1 and user 2
    const conversation = await db.insert(conversationsTable)
      .values({
        post_id: post[0].id,
        user1_id: users[0].id,
        user2_id: users[1].id
      })
      .returning()
      .execute();

    // Try to mark messages as read with user 3 (who is not part of the conversation)
    await expect(markMessagesRead(conversation[0].id, users[2].id))
      .rejects.toThrow(/does not have access/i);
  });

  it('should work correctly for user2 as well as user1', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@test.com',
          password_hash: 'hash1',
          first_name: 'User',
          last_name: 'One',
          preferred_language: 'en'
        },
        {
          email: 'user2@test.com',
          password_hash: 'hash2',
          first_name: 'User',
          last_name: 'Two',
          preferred_language: 'en'
        }
      ])
      .returning()
      .execute();

    // Create test post
    const post = await db.insert(postsTable)
      .values({
        user_id: users[0].id,
        title: 'Test Post',
        description: 'Test Description',
        type: 'lost',
        category: 'electronics',
        contact_info: 'test@example.com'
      })
      .returning()
      .execute();

    // Create conversation
    const conversation = await db.insert(conversationsTable)
      .values({
        post_id: post[0].id,
        user1_id: users[0].id,
        user2_id: users[1].id
      })
      .returning()
      .execute();

    // Create test messages from user 1
    await db.insert(messagesTable)
      .values([
        {
          conversation_id: conversation[0].id,
          sender_id: users[0].id,
          content: 'Message from user 1',
          is_read: false
        },
        {
          conversation_id: conversation[0].id,
          sender_id: users[0].id,
          content: 'Another message from user 1',
          is_read: false
        }
      ])
      .execute();

    // Mark messages as read for user 2 (should mark messages from user 1 as read)
    await markMessagesRead(conversation[0].id, users[1].id);

    // Verify messages from user 1 are marked as read
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.conversation_id, conversation[0].id))
      .execute();

    messages.forEach(message => {
      expect(message.is_read).toBe(true);
    });
  });

  it('should handle conversation with no messages gracefully', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@test.com',
          password_hash: 'hash1',
          first_name: 'User',
          last_name: 'One',
          preferred_language: 'en'
        },
        {
          email: 'user2@test.com',
          password_hash: 'hash2',
          first_name: 'User',
          last_name: 'Two',
          preferred_language: 'en'
        }
      ])
      .returning()
      .execute();

    // Create test post
    const post = await db.insert(postsTable)
      .values({
        user_id: users[0].id,
        title: 'Test Post',
        description: 'Test Description',
        type: 'lost',
        category: 'electronics',
        contact_info: 'test@example.com'
      })
      .returning()
      .execute();

    // Create conversation with no messages
    const conversation = await db.insert(conversationsTable)
      .values({
        post_id: post[0].id,
        user1_id: users[0].id,
        user2_id: users[1].id
      })
      .returning()
      .execute();

    // Should not throw error even with no messages
    await expect(markMessagesRead(conversation[0].id, users[0].id))
      .resolves.toBeUndefined();
  });
});