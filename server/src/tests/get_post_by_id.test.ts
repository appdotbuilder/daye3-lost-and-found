import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, postImagesTable } from '../db/schema';
import { getPostById } from '../handlers/get_post_by_id';

describe('getPostById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return a post with images and user information', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test post with location
    const postResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        title: 'Lost car keys',
        description: 'Lost my Honda car keys near downtown',
        type: 'lost',
        category: 'other',
        location_text: 'Downtown area',
        latitude: '33.8938',
        longitude: '35.5018',
        contact_info: '+961123456789',
        status: 'active'
      })
      .returning()
      .execute();

    const postId = postResult[0].id;

    // Create test images
    await db.insert(postImagesTable)
      .values([
        {
          post_id: postId,
          image_url: 'https://example.com/image1.jpg',
          alt_text: 'Keys on ground',
          order_index: 0
        },
        {
          post_id: postId,
          image_url: 'https://example.com/image2.jpg',
          alt_text: 'Close-up of keys',
          order_index: 1
        }
      ])
      .execute();

    const result = await getPostById(postId);

    // Verify post data
    expect(result).toBeDefined();
    expect(result!.id).toEqual(postId);
    expect(result!.user_id).toEqual(userId);
    expect(result!.title).toEqual('Lost car keys');
    expect(result!.description).toEqual('Lost my Honda car keys near downtown');
    expect(result!.type).toEqual('lost');
    expect(result!.category).toEqual('other');
    expect(result!.location_text).toEqual('Downtown area');
    expect(result!.contact_info).toEqual('+961123456789');
    expect(result!.status).toEqual('active');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);

    // Verify numeric field conversion
    expect(typeof result!.latitude).toBe('number');
    expect(typeof result!.longitude).toBe('number');
    expect(result!.latitude).toEqual(33.8938);
    expect(result!.longitude).toEqual(35.5018);

    // Verify user information
    expect(result!.user.id).toEqual(userId);
    expect(result!.user.first_name).toEqual('John');
    expect(result!.user.last_name).toEqual('Doe');

    // Verify images are included and ordered
    expect(result!.images).toHaveLength(2);
    expect(result!.images[0].image_url).toEqual('https://example.com/image1.jpg');
    expect(result!.images[0].alt_text).toEqual('Keys on ground');
    expect(result!.images[0].order_index).toEqual(0);
    expect(result!.images[1].image_url).toEqual('https://example.com/image2.jpg');
    expect(result!.images[1].alt_text).toEqual('Close-up of keys');
    expect(result!.images[1].order_index).toEqual(1);
  });

  it('should return a post without images', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Jane',
        last_name: 'Smith',
        preferred_language: 'ar'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test post without location data
    const postResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        title: 'Found wallet',
        description: 'Found a leather wallet with ID cards',
        type: 'found',
        category: 'documents',
        location_text: null,
        latitude: null,
        longitude: null,
        contact_info: 'jane@example.com',
        status: 'active'
      })
      .returning()
      .execute();

    const postId = postResult[0].id;

    const result = await getPostById(postId);

    // Verify post data
    expect(result).toBeDefined();
    expect(result!.id).toEqual(postId);
    expect(result!.title).toEqual('Found wallet');
    expect(result!.type).toEqual('found');
    expect(result!.category).toEqual('documents');
    expect(result!.location_text).toBeNull();
    expect(result!.latitude).toBeNull();
    expect(result!.longitude).toBeNull();

    // Verify user information
    expect(result!.user.first_name).toEqual('Jane');
    expect(result!.user.last_name).toEqual('Smith');

    // Verify no images
    expect(result!.images).toHaveLength(0);
  });

  it('should return null for non-existent post', async () => {
    const result = await getPostById(99999);
    expect(result).toBeNull();
  });

  it('should handle post with numeric location data correctly', async () => {
    // Create test user
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

    const userId = userResult[0].id;

    // Create post with precise coordinates
    const postResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        title: 'Lost phone',
        description: 'Lost iPhone in the park',
        type: 'lost',
        category: 'electronics',
        location_text: 'Central Park',
        latitude: '33.88760123',
        longitude: '35.51234567',
        contact_info: '+961987654321',
        status: 'active'
      })
      .returning()
      .execute();

    const result = await getPostById(postResult[0].id);

    // Verify precise numeric conversion
    expect(result!.latitude).toEqual(33.88760123);
    expect(result!.longitude).toEqual(35.51234567);
    expect(typeof result!.latitude).toBe('number');
    expect(typeof result!.longitude).toBe('number');
  });

  it('should return images in correct order', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Order',
        last_name: 'Test',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test post
    const postResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        title: 'Test post with ordered images',
        description: 'Testing image ordering',
        type: 'found',
        category: 'other',
        contact_info: 'test@example.com'
      })
      .returning()
      .execute();

    const postId = postResult[0].id;

    // Insert images with mixed order indices
    await db.insert(postImagesTable)
      .values([
        {
          post_id: postId,
          image_url: 'https://example.com/third.jpg',
          order_index: 2
        },
        {
          post_id: postId,
          image_url: 'https://example.com/first.jpg',
          order_index: 0
        },
        {
          post_id: postId,
          image_url: 'https://example.com/second.jpg',
          order_index: 1
        }
      ])
      .execute();

    const result = await getPostById(postId);

    // Verify images are returned in correct order
    expect(result!.images).toHaveLength(3);
    expect(result!.images[0].image_url).toEqual('https://example.com/first.jpg');
    expect(result!.images[0].order_index).toEqual(0);
    expect(result!.images[1].image_url).toEqual('https://example.com/second.jpg');
    expect(result!.images[1].order_index).toEqual(1);
    expect(result!.images[2].image_url).toEqual('https://example.com/third.jpg');
    expect(result!.images[2].order_index).toEqual(2);
  });
});