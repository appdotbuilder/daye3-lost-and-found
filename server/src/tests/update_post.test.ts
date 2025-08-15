import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, postImagesTable } from '../db/schema';
import { type UpdatePostInput } from '../schema';
import { updatePost } from '../handlers/update_post';
import { eq } from 'drizzle-orm';

describe('updatePost', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testPostId: number;

  beforeEach(async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Doe',
        preferred_language: 'en'
      })
      .returning()
      .execute();
    testUserId = users[0].id;

    // Create test post
    const posts = await db.insert(postsTable)
      .values({
        user_id: testUserId,
        title: 'Lost Phone',
        description: 'Lost my iPhone 13',
        type: 'lost',
        category: 'electronics',
        location_text: 'Downtown Beirut',
        latitude: '33.8938',
        longitude: '35.5018',
        contact_info: '+961123456789',
        status: 'active'
      })
      .returning()
      .execute();
    testPostId = posts[0].id;

    // Create test images
    await db.insert(postImagesTable)
      .values([
        {
          post_id: testPostId,
          image_url: 'https://example.com/image1.jpg',
          alt_text: 'Phone front',
          order_index: 0
        },
        {
          post_id: testPostId,
          image_url: 'https://example.com/image2.jpg',
          alt_text: 'Phone back',
          order_index: 1
        }
      ])
      .execute();
  });

  it('should update post with all fields', async () => {
    const updateInput: UpdatePostInput = {
      id: testPostId,
      title: 'Updated Lost Phone',
      description: 'Updated description for my lost iPhone',
      location_text: 'Updated location',
      latitude: 33.9000,
      longitude: 35.5500,
      contact_info: '+961987654321',
      status: 'resolved'
    };

    const result = await updatePost(updateInput);

    // Verify all updated fields
    expect(result.id).toBe(testPostId);
    expect(result.title).toBe('Updated Lost Phone');
    expect(result.description).toBe('Updated description for my lost iPhone');
    expect(result.location_text).toBe('Updated location');
    expect(result.latitude).toBe(33.9000);
    expect(result.longitude).toBe(35.5500);
    expect(result.contact_info).toBe('+961987654321');
    expect(result.status).toBe('resolved');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.user_id).toBe(testUserId);

    // Verify user information is included
    expect(result.user.id).toBe(testUserId);
    expect(result.user.first_name).toBe('John');
    expect(result.user.last_name).toBe('Doe');

    // Verify images are included
    expect(result.images).toHaveLength(2);
    expect(result.images[0].image_url).toBe('https://example.com/image1.jpg');
    expect(result.images[1].image_url).toBe('https://example.com/image2.jpg');
  });

  it('should update only provided fields', async () => {
    const updateInput: UpdatePostInput = {
      id: testPostId,
      title: 'Only Title Updated',
      status: 'closed'
    };

    const result = await updatePost(updateInput);

    // Verify updated fields
    expect(result.title).toBe('Only Title Updated');
    expect(result.status).toBe('closed');

    // Verify unchanged fields remain the same
    expect(result.description).toBe('Lost my iPhone 13');
    expect(result.location_text).toBe('Downtown Beirut');
    expect(result.latitude).toBe(33.8938);
    expect(result.longitude).toBe(35.5018);
    expect(result.contact_info).toBe('+961123456789');
    expect(result.type).toBe('lost');
    expect(result.category).toBe('electronics');
  });

  it('should handle null latitude and longitude', async () => {
    const updateInput: UpdatePostInput = {
      id: testPostId,
      latitude: null,
      longitude: null,
      location_text: null
    };

    const result = await updatePost(updateInput);

    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.location_text).toBeNull();
  });

  it('should update database record correctly', async () => {
    const updateInput: UpdatePostInput = {
      id: testPostId,
      title: 'Database Test Title',
      status: 'resolved'
    };

    await updatePost(updateInput);

    // Verify database was updated
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, testPostId))
      .execute();

    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe('Database Test Title');
    expect(posts[0].status).toBe('resolved');
    expect(posts[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return numeric types for coordinates', async () => {
    const updateInput: UpdatePostInput = {
      id: testPostId,
      latitude: 34.0000,
      longitude: 36.0000
    };

    const result = await updatePost(updateInput);

    expect(typeof result.latitude).toBe('number');
    expect(typeof result.longitude).toBe('number');
    expect(result.latitude).toBe(34.0000);
    expect(result.longitude).toBe(36.0000);
  });

  it('should throw error for non-existent post', async () => {
    const updateInput: UpdatePostInput = {
      id: 999999,
      title: 'This should fail'
    };

    await expect(updatePost(updateInput)).rejects.toThrow(/Post not found/i);
  });

  it('should preserve original created_at timestamp', async () => {
    // Get original created_at
    const originalPosts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, testPostId))
      .execute();
    const originalCreatedAt = originalPosts[0].created_at;

    const updateInput: UpdatePostInput = {
      id: testPostId,
      title: 'Updated Title'
    };

    const result = await updatePost(updateInput);

    // Verify created_at is preserved and updated_at is different
    expect(result.created_at).toEqual(originalCreatedAt);
    expect(result.updated_at).not.toEqual(originalCreatedAt);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalCreatedAt.getTime());
  });

  it('should include images in correct order', async () => {
    const updateInput: UpdatePostInput = {
      id: testPostId,
      title: 'Test Image Order'
    };

    const result = await updatePost(updateInput);

    expect(result.images).toHaveLength(2);
    expect(result.images[0].order_index).toBe(0);
    expect(result.images[0].alt_text).toBe('Phone front');
    expect(result.images[1].order_index).toBe(1);
    expect(result.images[1].alt_text).toBe('Phone back');
  });
});