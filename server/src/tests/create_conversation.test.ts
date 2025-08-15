import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { conversationsTable, postsTable, usersTable } from '../db/schema';
import { type CreateConversationInput } from '../schema';
import { createConversation } from '../handlers/create_conversation';
import { eq, and, or } from 'drizzle-orm';

describe('createConversation', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser1Id: number;
  let testUser2Id: number;
  let testPostId: number;

  beforeEach(async () => {
    // Create test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashedpassword1',
        first_name: 'John',
        last_name: 'Doe',
        preferred_language: 'en'
      })
      .returning()
      .execute();
    testUser1Id = user1Result[0].id;

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashedpassword2',
        first_name: 'Jane',
        last_name: 'Smith',
        preferred_language: 'en'
      })
      .returning()
      .execute();
    testUser2Id = user2Result[0].id;

    // Create test post
    const postResult = await db.insert(postsTable)
      .values({
        user_id: testUser1Id,
        title: 'Lost Keys',
        description: 'Lost my house keys near downtown',
        type: 'lost',
        category: 'other',
        contact_info: 'john@example.com'
      })
      .returning()
      .execute();
    testPostId = postResult[0].id;
  });

  it('should create a new conversation', async () => {
    const input: CreateConversationInput = {
      post_id: testPostId,
      user1_id: testUser1Id,
      user2_id: testUser2Id
    };

    const result = await createConversation(input);

    // Verify conversation was created with correct data
    expect(result.post_id).toEqual(testPostId);
    expect(result.user1_id).toEqual(testUser1Id);
    expect(result.user2_id).toEqual(testUser2Id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.last_message_at).toBeInstanceOf(Date);
  });

  it('should save conversation to database', async () => {
    const input: CreateConversationInput = {
      post_id: testPostId,
      user1_id: testUser1Id,
      user2_id: testUser2Id
    };

    const result = await createConversation(input);

    // Verify conversation exists in database
    const conversations = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, result.id))
      .execute();

    expect(conversations).toHaveLength(1);
    expect(conversations[0].post_id).toEqual(testPostId);
    expect(conversations[0].user1_id).toEqual(testUser1Id);
    expect(conversations[0].user2_id).toEqual(testUser2Id);
  });

  it('should return existing conversation if one already exists (same order)', async () => {
    // Create initial conversation
    const input: CreateConversationInput = {
      post_id: testPostId,
      user1_id: testUser1Id,
      user2_id: testUser2Id
    };

    const firstResult = await createConversation(input);

    // Try to create the same conversation again
    const secondResult = await createConversation(input);

    // Should return the same conversation
    expect(secondResult.id).toEqual(firstResult.id);
    expect(secondResult.post_id).toEqual(firstResult.post_id);
    expect(secondResult.user1_id).toEqual(firstResult.user1_id);
    expect(secondResult.user2_id).toEqual(firstResult.user2_id);

    // Verify only one conversation exists in database
    const conversations = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.post_id, testPostId))
      .execute();

    expect(conversations).toHaveLength(1);
  });

  it('should return existing conversation if one already exists (reversed order)', async () => {
    // Create initial conversation
    const input1: CreateConversationInput = {
      post_id: testPostId,
      user1_id: testUser1Id,
      user2_id: testUser2Id
    };

    const firstResult = await createConversation(input1);

    // Try to create conversation with users reversed
    const input2: CreateConversationInput = {
      post_id: testPostId,
      user1_id: testUser2Id,
      user2_id: testUser1Id
    };

    const secondResult = await createConversation(input2);

    // Should return the same conversation
    expect(secondResult.id).toEqual(firstResult.id);

    // Verify only one conversation exists in database
    const conversations = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.post_id, testPostId))
      .execute();

    expect(conversations).toHaveLength(1);
  });

  it('should throw error if post does not exist', async () => {
    const input: CreateConversationInput = {
      post_id: 99999, // Non-existent post
      user1_id: testUser1Id,
      user2_id: testUser2Id
    };

    await expect(createConversation(input)).rejects.toThrow(/post.*not found/i);
  });

  it('should throw error if user1 does not exist', async () => {
    const input: CreateConversationInput = {
      post_id: testPostId,
      user1_id: 99999, // Non-existent user
      user2_id: testUser2Id
    };

    await expect(createConversation(input)).rejects.toThrow(/users.*not found/i);
  });

  it('should throw error if user2 does not exist', async () => {
    const input: CreateConversationInput = {
      post_id: testPostId,
      user1_id: testUser1Id,
      user2_id: 99999 // Non-existent user
    };

    await expect(createConversation(input)).rejects.toThrow(/users.*not found/i);
  });

  it('should throw error if both users do not exist', async () => {
    const input: CreateConversationInput = {
      post_id: testPostId,
      user1_id: 99998, // Non-existent user
      user2_id: 99999 // Non-existent user
    };

    await expect(createConversation(input)).rejects.toThrow(/users.*not found/i);
  });

  it('should allow same user to create conversations for different posts', async () => {
    // Create another test post
    const post2Result = await db.insert(postsTable)
      .values({
        user_id: testUser2Id,
        title: 'Found Wallet',
        description: 'Found a wallet in the park',
        type: 'found',
        category: 'other',
        contact_info: 'jane@example.com'
      })
      .returning()
      .execute();
    const testPost2Id = post2Result[0].id;

    // Create conversation for first post
    const input1: CreateConversationInput = {
      post_id: testPostId,
      user1_id: testUser1Id,
      user2_id: testUser2Id
    };

    const result1 = await createConversation(input1);

    // Create conversation for second post with same users
    const input2: CreateConversationInput = {
      post_id: testPost2Id,
      user1_id: testUser1Id,
      user2_id: testUser2Id
    };

    const result2 = await createConversation(input2);

    // Should be different conversations
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.post_id).toEqual(testPostId);
    expect(result2.post_id).toEqual(testPost2Id);

    // Verify both conversations exist in database
    const conversations = await db.select()
      .from(conversationsTable)
      .where(or(
        eq(conversationsTable.post_id, testPostId),
        eq(conversationsTable.post_id, testPost2Id)
      ))
      .execute();

    expect(conversations).toHaveLength(2);
  });
});