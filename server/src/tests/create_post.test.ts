import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, postImagesTable } from '../db/schema';
import { type CreatePostInput } from '../schema';
import { createPost } from '../handlers/create_post';
import { eq } from 'drizzle-orm';

describe('createPost', () => {
  let testUserId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Doe',
        preferred_language: 'en'
      })
      .returning()
      .execute();
    
    testUserId = userResult[0].id;
  });

  afterEach(resetDB);

  const baseTestInput: CreatePostInput = {
    user_id: 0, // Will be set to testUserId in tests
    title: 'Lost Phone',
    description: 'iPhone 13 lost at Central Park',
    type: 'lost',
    category: 'electronics',
    location_text: 'Central Park, NYC',
    latitude: 40.785091,
    longitude: -73.968285,
    contact_info: 'Call 555-0123'
  };

  it('should create a post without images', async () => {
    const input = { ...baseTestInput, user_id: testUserId };
    const result = await createPost(input);

    // Verify post fields
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(testUserId);
    expect(result.title).toEqual('Lost Phone');
    expect(result.description).toEqual('iPhone 13 lost at Central Park');
    expect(result.type).toEqual('lost');
    expect(result.category).toEqual('electronics');
    expect(result.location_text).toEqual('Central Park, NYC');
    expect(result.latitude).toEqual(40.785091);
    expect(result.longitude).toEqual(-73.968285);
    expect(result.contact_info).toEqual('Call 555-0123');
    expect(result.status).toEqual('active');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify numeric types
    expect(typeof result.latitude).toBe('number');
    expect(typeof result.longitude).toBe('number');

    // Verify user info
    expect(result.user.id).toEqual(testUserId);
    expect(result.user.first_name).toEqual('John');
    expect(result.user.last_name).toEqual('Doe');

    // Verify no images
    expect(result.images).toEqual([]);
  });

  it('should create a post with images', async () => {
    const input: CreatePostInput = {
      ...baseTestInput,
      user_id: testUserId,
      images: [
        { image_url: 'https://example.com/image1.jpg', alt_text: 'Front view' },
        { image_url: 'https://example.com/image2.jpg', alt_text: null }
      ]
    };

    const result = await createPost(input);

    // Verify post creation
    expect(result.id).toBeDefined();
    expect(result.title).toEqual('Lost Phone');

    // Verify images
    expect(result.images).toHaveLength(2);
    expect(result.images[0].image_url).toEqual('https://example.com/image1.jpg');
    expect(result.images[0].alt_text).toEqual('Front view');
    expect(result.images[0].order_index).toEqual(0);
    expect(result.images[1].image_url).toEqual('https://example.com/image2.jpg');
    expect(result.images[1].alt_text).toBeNull();
    expect(result.images[1].order_index).toEqual(1);
  });

  it('should handle null location coordinates', async () => {
    const input: CreatePostInput = {
      ...baseTestInput,
      user_id: testUserId,
      latitude: null,
      longitude: null
    };

    const result = await createPost(input);

    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
  });

  it('should handle optional fields', async () => {
    const input: CreatePostInput = {
      user_id: testUserId,
      title: 'Found Keys',
      description: 'Set of house keys found',
      type: 'found',
      category: 'other',
      contact_info: 'Email: finder@example.com'
      // location_text, latitude, longitude, images not provided
    };

    const result = await createPost(input);

    expect(result.title).toEqual('Found Keys');
    expect(result.type).toEqual('found');
    expect(result.category).toEqual('other');
    expect(result.location_text).toBeNull();
    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.images).toEqual([]);
  });

  it('should save post to database', async () => {
    const input = { ...baseTestInput, user_id: testUserId };
    const result = await createPost(input);

    // Verify post exists in database
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, result.id))
      .execute();

    expect(posts).toHaveLength(1);
    expect(posts[0].title).toEqual('Lost Phone');
    expect(posts[0].user_id).toEqual(testUserId);
    expect(parseFloat(posts[0].latitude!)).toEqual(40.785091);
    expect(parseFloat(posts[0].longitude!)).toEqual(-73.968285);
  });

  it('should save images to database', async () => {
    const input: CreatePostInput = {
      ...baseTestInput,
      user_id: testUserId,
      images: [
        { image_url: 'https://example.com/test.jpg', alt_text: 'Test image' }
      ]
    };

    const result = await createPost(input);

    // Verify images exist in database
    const images = await db.select()
      .from(postImagesTable)
      .where(eq(postImagesTable.post_id, result.id))
      .execute();

    expect(images).toHaveLength(1);
    expect(images[0].image_url).toEqual('https://example.com/test.jpg');
    expect(images[0].alt_text).toEqual('Test image');
    expect(images[0].order_index).toEqual(0);
  });

  it('should throw error for non-existent user', async () => {
    const input = { ...baseTestInput, user_id: 99999 }; // Non-existent user ID

    await expect(createPost(input)).rejects.toThrow(/User not found/i);
  });

  it('should handle all post categories', async () => {
    const categories = ['person', 'car', 'furniture', 'electronics', 'documents', 'jewelry', 'clothing', 'other'] as const;
    
    for (const category of categories) {
      const input: CreatePostInput = {
        ...baseTestInput,
        user_id: testUserId,
        title: `Test ${category}`,
        category: category
      };

      const result = await createPost(input);
      expect(result.category).toEqual(category);
    }
  });

  it('should handle both post types', async () => {
    // Test 'lost' type
    const lostInput = { ...baseTestInput, user_id: testUserId, type: 'lost' as const };
    const lostResult = await createPost(lostInput);
    expect(lostResult.type).toEqual('lost');

    // Test 'found' type  
    const foundInput = { ...baseTestInput, user_id: testUserId, type: 'found' as const };
    const foundResult = await createPost(foundInput);
    expect(foundResult.type).toEqual('found');
  });
});