import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, conversationsTable, messagesTable } from '../db/schema';
import { type SendMessageInput } from '../schema';
import { sendMessage } from '../handlers/send_message';
import { eq } from 'drizzle-orm';

describe('sendMessage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create test data helper
  const createTestData = async () => {
    // Create users
    const userResults = await db.insert(usersTable)
      .values([
        {
          email: 'user1@example.com',
          password_hash: 'hash1',
          first_name: 'User',
          last_name: 'One',
          preferred_language: 'en' as const
        },
        {
          email: 'user2@example.com',
          password_hash: 'hash2',
          first_name: 'User',
          last_name: 'Two',
          preferred_language: 'en' as const
        },
        {
          email: 'user3@example.com',
          password_hash: 'hash3',
          first_name: 'User',
          last_name: 'Three',
          preferred_language: 'en' as const
        }
      ])
      .returning()
      .execute();

    const [user1, user2, user3] = userResults;

    // Create a post
    const postResult = await db.insert(postsTable)
      .values({
        user_id: user1.id,
        title: 'Lost Phone',
        description: 'Lost my iPhone',
        type: 'lost' as const,
        category: 'electronics' as const,
        contact_info: 'contact@example.com'
      })
      .returning()
      .execute();

    const post = postResult[0];

    // Create a conversation
    const conversationResult = await db.insert(conversationsTable)
      .values({
        post_id: post.id,
        user1_id: user1.id,
        user2_id: user2.id
      })
      .returning()
      .execute();

    const conversation = conversationResult[0];

    return { user1, user2, user3, post, conversation };
  };

  it('should send a message successfully when sender is user1', async () => {
    const { user1, conversation } = await createTestData();

    const input: SendMessageInput = {
      conversation_id: conversation.id,
      sender_id: user1.id,
      content: 'Hello, is this still available?'
    };

    const result = await sendMessage(input);

    // Verify message properties
    expect(result.id).toBeDefined();
    expect(result.conversation_id).toBe(conversation.id);
    expect(result.sender_id).toBe(user1.id);
    expect(result.content).toBe('Hello, is this still available?');
    expect(result.is_read).toBe(false);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should send a message successfully when sender is user2', async () => {
    const { user2, conversation } = await createTestData();

    const input: SendMessageInput = {
      conversation_id: conversation.id,
      sender_id: user2.id,
      content: 'Yes, it is still available!'
    };

    const result = await sendMessage(input);

    // Verify message properties
    expect(result.id).toBeDefined();
    expect(result.conversation_id).toBe(conversation.id);
    expect(result.sender_id).toBe(user2.id);
    expect(result.content).toBe('Yes, it is still available!');
    expect(result.is_read).toBe(false);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save message to database', async () => {
    const { user1, conversation } = await createTestData();

    const input: SendMessageInput = {
      conversation_id: conversation.id,
      sender_id: user1.id,
      content: 'Test message content'
    };

    const result = await sendMessage(input);

    // Verify message was saved in database
    const savedMessages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, result.id))
      .execute();

    expect(savedMessages).toHaveLength(1);
    expect(savedMessages[0].conversation_id).toBe(conversation.id);
    expect(savedMessages[0].sender_id).toBe(user1.id);
    expect(savedMessages[0].content).toBe('Test message content');
    expect(savedMessages[0].is_read).toBe(false);
  });

  it('should update conversation last_message_at timestamp', async () => {
    const { user1, conversation } = await createTestData();

    // Get initial timestamp
    const initialConversations = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversation.id))
      .execute();

    const initialTimestamp = initialConversations[0].last_message_at;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const input: SendMessageInput = {
      conversation_id: conversation.id,
      sender_id: user1.id,
      content: 'This should update the timestamp'
    };

    await sendMessage(input);

    // Verify timestamp was updated
    const updatedConversations = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversation.id))
      .execute();

    const updatedTimestamp = updatedConversations[0].last_message_at;
    expect(updatedTimestamp > initialTimestamp).toBe(true);
  });

  it('should throw error when conversation does not exist', async () => {
    const { user1 } = await createTestData();

    const input: SendMessageInput = {
      conversation_id: 99999, // Non-existent conversation
      sender_id: user1.id,
      content: 'This should fail'
    };

    await expect(sendMessage(input)).rejects.toThrow(/conversation not found/i);
  });

  it('should throw error when sender does not have access to conversation', async () => {
    const { user3, conversation } = await createTestData();

    const input: SendMessageInput = {
      conversation_id: conversation.id,
      sender_id: user3.id, // user3 is not part of this conversation
      content: 'This should fail'
    };

    await expect(sendMessage(input)).rejects.toThrow(/does not have access/i);
  });

  it('should handle multiple messages in sequence', async () => {
    const { user1, user2, conversation } = await createTestData();

    // Send first message from user1
    const message1 = await sendMessage({
      conversation_id: conversation.id,
      sender_id: user1.id,
      content: 'First message'
    });

    // Send reply from user2
    const message2 = await sendMessage({
      conversation_id: conversation.id,
      sender_id: user2.id,
      content: 'Reply message'
    });

    // Send another message from user1
    const message3 = await sendMessage({
      conversation_id: conversation.id,
      sender_id: user1.id,
      content: 'Third message'
    });

    // Verify all messages exist in database
    const allMessages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.conversation_id, conversation.id))
      .execute();

    expect(allMessages).toHaveLength(3);
    
    // Verify message order and content
    const sortedMessages = allMessages.sort((a, b) => a.id - b.id);
    expect(sortedMessages[0].content).toBe('First message');
    expect(sortedMessages[0].sender_id).toBe(user1.id);
    expect(sortedMessages[1].content).toBe('Reply message');
    expect(sortedMessages[1].sender_id).toBe(user2.id);
    expect(sortedMessages[2].content).toBe('Third message');
    expect(sortedMessages[2].sender_id).toBe(user1.id);
  });
});