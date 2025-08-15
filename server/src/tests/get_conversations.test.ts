import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, conversationsTable, messagesTable } from '../db/schema';
import { getConversations } from '../handlers/get_conversations';

describe('getConversations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no conversations', async () => {
    // Create a user with no conversations
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'User',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const result = await getConversations(userResult[0].id);

    expect(result).toEqual([]);
  });

  it('should return conversations where user is user1', async () => {
    // Create two users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Jane',
        last_name: 'Smith',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    // Create a post
    const postResult = await db.insert(postsTable)
      .values({
        user_id: user1Result[0].id,
        title: 'Lost car keys',
        description: 'Lost my car keys near the mall',
        type: 'lost',
        category: 'other',
        contact_info: 'john@example.com'
      })
      .returning()
      .execute();

    // Create a conversation
    const conversationResult = await db.insert(conversationsTable)
      .values({
        post_id: postResult[0].id,
        user1_id: user1Result[0].id,
        user2_id: user2Result[0].id
      })
      .returning()
      .execute();

    // Add a message
    await db.insert(messagesTable)
      .values({
        conversation_id: conversationResult[0].id,
        sender_id: user2Result[0].id,
        content: 'Hi, I found your keys!'
      })
      .execute();

    const result = await getConversations(user1Result[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(conversationResult[0].id);
    expect(result[0].post.title).toEqual('Lost car keys');
    expect(result[0].post.type).toEqual('lost');
    expect(result[0].other_user.first_name).toEqual('Jane');
    expect(result[0].other_user.last_name).toEqual('Smith');
    expect(result[0].messages).toHaveLength(1);
    expect(result[0].messages[0].content).toEqual('Hi, I found your keys!');
  });

  it('should return conversations where user is user2', async () => {
    // Create two users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Jane',
        last_name: 'Smith',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    // Create a post
    const postResult = await db.insert(postsTable)
      .values({
        user_id: user1Result[0].id,
        title: 'Found wallet',
        description: 'Found a wallet in the park',
        type: 'found',
        category: 'other',
        contact_info: 'john@example.com'
      })
      .returning()
      .execute();

    // Create a conversation where user2 is the second participant
    const conversationResult = await db.insert(conversationsTable)
      .values({
        post_id: postResult[0].id,
        user1_id: user1Result[0].id,
        user2_id: user2Result[0].id
      })
      .returning()
      .execute();

    const result = await getConversations(user2Result[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(conversationResult[0].id);
    expect(result[0].other_user.first_name).toEqual('John');
    expect(result[0].other_user.last_name).toEqual('Doe');
  });

  it('should return multiple conversations ordered by last_message_at descending', async () => {
    // Create users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Jane',
        last_name: 'Smith',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const user3Result = await db.insert(usersTable)
      .values({
        email: 'user3@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Bob',
        last_name: 'Wilson',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    // Create posts
    const post1Result = await db.insert(postsTable)
      .values({
        user_id: user1Result[0].id,
        title: 'Lost phone',
        description: 'Lost my phone',
        type: 'lost',
        category: 'electronics',
        contact_info: 'john@example.com'
      })
      .returning()
      .execute();

    const post2Result = await db.insert(postsTable)
      .values({
        user_id: user1Result[0].id,
        title: 'Lost laptop',
        description: 'Lost my laptop',
        type: 'lost',
        category: 'electronics',
        contact_info: 'john@example.com'
      })
      .returning()
      .execute();

    // Create conversations with different timestamps
    const olderTime = new Date('2024-01-01T10:00:00Z');
    const newerTime = new Date('2024-01-02T10:00:00Z');

    const conversation1Result = await db.insert(conversationsTable)
      .values({
        post_id: post1Result[0].id,
        user1_id: user1Result[0].id,
        user2_id: user2Result[0].id,
        last_message_at: olderTime
      })
      .returning()
      .execute();

    const conversation2Result = await db.insert(conversationsTable)
      .values({
        post_id: post2Result[0].id,
        user1_id: user1Result[0].id,
        user2_id: user3Result[0].id,
        last_message_at: newerTime
      })
      .returning()
      .execute();

    const result = await getConversations(user1Result[0].id);

    expect(result).toHaveLength(2);
    // Should be ordered by last_message_at descending (newest first)
    expect(result[0].id).toEqual(conversation2Result[0].id);
    expect(result[0].post.title).toEqual('Lost laptop');
    expect(result[0].other_user.first_name).toEqual('Bob');
    expect(result[1].id).toEqual(conversation1Result[0].id);
    expect(result[1].post.title).toEqual('Lost phone');
    expect(result[1].other_user.first_name).toEqual('Jane');
  });

  it('should include multiple messages in correct order', async () => {
    // Create users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Jane',
        last_name: 'Smith',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    // Create a post
    const postResult = await db.insert(postsTable)
      .values({
        user_id: user1Result[0].id,
        title: 'Lost keys',
        description: 'Lost my house keys',
        type: 'lost',
        category: 'other',
        contact_info: 'john@example.com'
      })
      .returning()
      .execute();

    // Create conversation
    const conversationResult = await db.insert(conversationsTable)
      .values({
        post_id: postResult[0].id,
        user1_id: user1Result[0].id,
        user2_id: user2Result[0].id
      })
      .returning()
      .execute();

    // Add multiple messages with different timestamps
    const firstMessageTime = new Date('2024-01-01T10:00:00Z');
    const secondMessageTime = new Date('2024-01-01T11:00:00Z');
    const thirdMessageTime = new Date('2024-01-01T12:00:00Z');

    await db.insert(messagesTable)
      .values({
        conversation_id: conversationResult[0].id,
        sender_id: user2Result[0].id,
        content: 'Hi, I found your keys!',
        created_at: firstMessageTime
      })
      .execute();

    await db.insert(messagesTable)
      .values({
        conversation_id: conversationResult[0].id,
        sender_id: user1Result[0].id,
        content: 'Really? Where did you find them?',
        created_at: secondMessageTime
      })
      .execute();

    await db.insert(messagesTable)
      .values({
        conversation_id: conversationResult[0].id,
        sender_id: user2Result[0].id,
        content: 'Near the coffee shop on Main Street',
        created_at: thirdMessageTime
      })
      .execute();

    const result = await getConversations(user1Result[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].messages).toHaveLength(3);
    
    // Messages should be ordered by created_at ascending (oldest first)
    expect(result[0].messages[0].content).toEqual('Hi, I found your keys!');
    expect(result[0].messages[1].content).toEqual('Really? Where did you find them?');
    expect(result[0].messages[2].content).toEqual('Near the coffee shop on Main Street');
    
    // Verify message properties
    expect(result[0].messages[0].sender_id).toEqual(user2Result[0].id);
    expect(result[0].messages[1].sender_id).toEqual(user1Result[0].id);
    expect(result[0].messages[0].is_read).toEqual(false);
  });

  it('should handle conversations without messages', async () => {
    // Create users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Jane',
        last_name: 'Smith',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    // Create a post
    const postResult = await db.insert(postsTable)
      .values({
        user_id: user1Result[0].id,
        title: 'Found dog',
        description: 'Found a lost dog',
        type: 'found',
        category: 'other',
        contact_info: 'john@example.com'
      })
      .returning()
      .execute();

    // Create conversation without messages
    const conversationResult = await db.insert(conversationsTable)
      .values({
        post_id: postResult[0].id,
        user1_id: user1Result[0].id,
        user2_id: user2Result[0].id
      })
      .returning()
      .execute();

    const result = await getConversations(user1Result[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(conversationResult[0].id);
    expect(result[0].messages).toEqual([]);
    expect(result[0].post.title).toEqual('Found dog');
    expect(result[0].other_user.first_name).toEqual('Jane');
  });
});