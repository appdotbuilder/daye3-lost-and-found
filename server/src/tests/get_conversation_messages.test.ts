import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, conversationsTable, messagesTable } from '../db/schema';
import { getConversationMessages } from '../handlers/get_conversation_messages';
import { eq } from 'drizzle-orm';

describe('getConversationMessages', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser1: any;
  let testUser2: any;
  let testUser3: any;
  let testPost: any;
  let testConversation: any;

  const setupTestData = async () => {
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

    testUser1 = users[0];
    testUser2 = users[1];
    testUser3 = users[2];

    // Create a test post
    const posts = await db.insert(postsTable)
      .values({
        user_id: testUser1.id,
        title: 'Lost Keys',
        description: 'Lost my house keys near the park',
        type: 'lost',
        category: 'other',
        contact_info: 'Call me at 123-456-7890'
      })
      .returning()
      .execute();

    testPost = posts[0];

    // Create a conversation
    const conversations = await db.insert(conversationsTable)
      .values({
        post_id: testPost.id,
        user1_id: testUser1.id,
        user2_id: testUser2.id
      })
      .returning()
      .execute();

    testConversation = conversations[0];
  };

  it('should fetch messages for a conversation', async () => {
    await setupTestData();

    // Add messages one by one with delays to ensure proper ordering
    const message1 = await db.insert(messagesTable)
      .values({
        conversation_id: testConversation.id,
        sender_id: testUser2.id,
        content: 'Hi, I found your keys!',
        is_read: false
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const message2 = await db.insert(messagesTable)
      .values({
        conversation_id: testConversation.id,
        sender_id: testUser1.id,
        content: 'Really? Where did you find them?',
        is_read: true
      })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    const message3 = await db.insert(messagesTable)
      .values({
        conversation_id: testConversation.id,
        sender_id: testUser2.id,
        content: 'Near the playground in Central Park',
        is_read: false
      })
      .returning()
      .execute();

    const messages = await getConversationMessages(testConversation.id, testUser1.id);

    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe('Near the playground in Central Park'); // Most recent first
    expect(messages[1].content).toBe('Really? Where did you find them?');
    expect(messages[2].content).toBe('Hi, I found your keys!'); // Oldest last
    
    // Verify all messages have required fields
    messages.forEach(message => {
      expect(message.id).toBeDefined();
      expect(message.conversation_id).toBe(testConversation.id);
      expect(message.sender_id).toBeDefined();
      expect(message.content).toBeDefined();
      expect(typeof message.is_read).toBe('boolean');
      expect(message.created_at).toBeInstanceOf(Date);
    });
  });

  it('should mark unread messages as read for the recipient', async () => {
    await setupTestData();

    // Add unread messages from user2 to user1
    await db.insert(messagesTable)
      .values([
        {
          conversation_id: testConversation.id,
          sender_id: testUser2.id,
          content: 'Message 1',
          is_read: false
        },
        {
          conversation_id: testConversation.id,
          sender_id: testUser2.id,
          content: 'Message 2',
          is_read: false
        }
      ])
      .execute();

    // User1 fetches messages - should mark them as read
    const messages = await getConversationMessages(testConversation.id, testUser1.id);

    expect(messages).toHaveLength(2);
    expect(messages[0].is_read).toBe(true);
    expect(messages[1].is_read).toBe(true);

    // Verify in database that messages are marked as read
    const dbMessages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.conversation_id, testConversation.id))
      .execute();

    dbMessages.forEach(msg => {
      expect(msg.is_read).toBe(true);
    });
  });

  it('should not mark own messages as read when fetching', async () => {
    await setupTestData();

    // Add messages from user1 (should remain as they are)
    await db.insert(messagesTable)
      .values([
        {
          conversation_id: testConversation.id,
          sender_id: testUser1.id,
          content: 'My own message',
          is_read: false
        }
      ])
      .execute();

    const messages = await getConversationMessages(testConversation.id, testUser1.id);

    expect(messages).toHaveLength(1);
    expect(messages[0].is_read).toBe(false); // Own message, should not be marked as read
  });

  it('should handle pagination with limit and offset', async () => {
    await setupTestData();

    // Add 5 test messages one by one with delays to ensure proper ordering
    for (let i = 1; i <= 5; i++) {
      await db.insert(messagesTable)
        .values({
          conversation_id: testConversation.id,
          sender_id: testUser2.id,
          content: `Message ${i}`,
          is_read: false
        })
        .execute();
      
      // Small delay between insertions
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Test with limit
    const firstPage = await getConversationMessages(testConversation.id, testUser1.id, 3, 0);
    expect(firstPage).toHaveLength(3);
    expect(firstPage[0].content).toBe('Message 5'); // Most recent first
    expect(firstPage[1].content).toBe('Message 4');
    expect(firstPage[2].content).toBe('Message 3');

    // Test with offset
    const secondPage = await getConversationMessages(testConversation.id, testUser1.id, 3, 3);
    expect(secondPage).toHaveLength(2);
    expect(secondPage[0].content).toBe('Message 2');
    expect(secondPage[1].content).toBe('Message 1');
  });

  it('should allow user2 to access the conversation', async () => {
    await setupTestData();

    await db.insert(messagesTable)
      .values({
        conversation_id: testConversation.id,
        sender_id: testUser1.id,
        content: 'Test message',
        is_read: false
      })
      .execute();

    const messages = await getConversationMessages(testConversation.id, testUser2.id);

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Test message');
  });

  it('should throw error if conversation does not exist', async () => {
    await setupTestData();

    await expect(
      getConversationMessages(999999, testUser1.id)
    ).rejects.toThrow(/conversation not found/i);
  });

  it('should throw error if user is not part of the conversation', async () => {
    await setupTestData();

    await db.insert(messagesTable)
      .values({
        conversation_id: testConversation.id,
        sender_id: testUser1.id,
        content: 'Test message',
        is_read: false
      })
      .execute();

    // testUser3 is not part of the conversation between testUser1 and testUser2
    await expect(
      getConversationMessages(testConversation.id, testUser3.id)
    ).rejects.toThrow(/access denied/i);
  });

  it('should return empty array for conversation with no messages', async () => {
    await setupTestData();

    const messages = await getConversationMessages(testConversation.id, testUser1.id);

    expect(messages).toHaveLength(0);
  });

  it('should preserve message order (newest first)', async () => {
    await setupTestData();

    // Add messages with slight delay to ensure different timestamps
    await db.insert(messagesTable)
      .values({
        conversation_id: testConversation.id,
        sender_id: testUser1.id,
        content: 'First message',
        is_read: false
      })
      .execute();

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(messagesTable)
      .values({
        conversation_id: testConversation.id,
        sender_id: testUser2.id,
        content: 'Second message',
        is_read: false
      })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(messagesTable)
      .values({
        conversation_id: testConversation.id,
        sender_id: testUser1.id,
        content: 'Third message',
        is_read: false
      })
      .execute();

    const messages = await getConversationMessages(testConversation.id, testUser1.id);

    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe('Third message'); // Most recent
    expect(messages[1].content).toBe('Second message');
    expect(messages[2].content).toBe('First message'); // Oldest
  });
});