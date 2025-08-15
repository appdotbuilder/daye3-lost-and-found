import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, postImagesTable } from '../db/schema';
import { getPosts } from '../handlers/get_posts';

describe('getPosts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no posts exist', async () => {
    const result = await getPosts();

    expect(result).toEqual([]);
  });

  it('should return posts with user information', async () => {
    // Create a user first
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

    const user = users[0];

    // Create a post
    const posts = await db.insert(postsTable)
      .values({
        user_id: user.id,
        title: 'Lost car keys',
        description: 'Lost my Honda car keys near downtown',
        type: 'lost',
        category: 'other',
        location_text: 'Downtown area',
        latitude: '33.89380000',
        longitude: '35.50180000',
        contact_info: '+961123456789',
        status: 'active'
      })
      .returning()
      .execute();

    const post = posts[0];

    const result = await getPosts();

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(post.id);
    expect(result[0].title).toEqual('Lost car keys');
    expect(result[0].description).toEqual('Lost my Honda car keys near downtown');
    expect(result[0].type).toEqual('lost');
    expect(result[0].category).toEqual('other');
    expect(result[0].location_text).toEqual('Downtown area');
    expect(result[0].latitude).toEqual(33.8938);
    expect(result[0].longitude).toEqual(35.5018);
    expect(typeof result[0].latitude).toBe('number');
    expect(typeof result[0].longitude).toBe('number');
    expect(result[0].contact_info).toEqual('+961123456789');
    expect(result[0].status).toEqual('active');
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);

    // Check user information
    expect(result[0].user.id).toEqual(user.id);
    expect(result[0].user.first_name).toEqual('John');
    expect(result[0].user.last_name).toEqual('Doe');

    // Check images array (should be empty)
    expect(result[0].images).toEqual([]);
  });

  it('should return posts with images in correct order', async () => {
    // Create a user
    const users = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Jane',
        last_name: 'Smith',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const user = users[0];

    // Create a post
    const posts = await db.insert(postsTable)
      .values({
        user_id: user.id,
        title: 'Found wallet',
        description: 'Found a black leather wallet',
        type: 'found',
        category: 'other',
        contact_info: 'contact@example.com'
      })
      .returning()
      .execute();

    const post = posts[0];

    // Create images in different order
    await db.insert(postImagesTable)
      .values([
        {
          post_id: post.id,
          image_url: 'https://example.com/image2.jpg',
          alt_text: 'Wallet back',
          order_index: 2
        },
        {
          post_id: post.id,
          image_url: 'https://example.com/image1.jpg',
          alt_text: 'Wallet front',
          order_index: 1
        },
        {
          post_id: post.id,
          image_url: 'https://example.com/image3.jpg',
          alt_text: 'Wallet inside',
          order_index: 3
        }
      ])
      .execute();

    const result = await getPosts();

    expect(result).toHaveLength(1);
    expect(result[0].images).toHaveLength(3);

    // Check images are sorted by order_index
    expect(result[0].images[0].order_index).toEqual(1);
    expect(result[0].images[0].image_url).toEqual('https://example.com/image1.jpg');
    expect(result[0].images[0].alt_text).toEqual('Wallet front');

    expect(result[0].images[1].order_index).toEqual(2);
    expect(result[0].images[1].image_url).toEqual('https://example.com/image2.jpg');
    expect(result[0].images[1].alt_text).toEqual('Wallet back');

    expect(result[0].images[2].order_index).toEqual(3);
    expect(result[0].images[2].image_url).toEqual('https://example.com/image3.jpg');
    expect(result[0].images[2].alt_text).toEqual('Wallet inside');
  });

  it('should apply pagination correctly', async () => {
    // Create a user
    const users = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const user = users[0];

    // Create 5 posts one by one to ensure different timestamps
    for (let i = 0; i < 5; i++) {
      await db.insert(postsTable)
        .values({
          user_id: user.id,
          title: `Post ${i + 1}`,
          description: `Description for post ${i + 1}`,
          type: 'lost' as const,
          category: 'other' as const,
          contact_info: 'contact@example.com'
        })
        .execute();
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    // Test limit
    const limitResult = await getPosts(3);
    expect(limitResult).toHaveLength(3);

    // Test offset
    const offsetResult = await getPosts(2, 2);
    expect(offsetResult).toHaveLength(2);

    // Test limit and offset together
    const bothResult = await getPosts(2, 1);
    expect(bothResult).toHaveLength(2);
    
    // Verify ordering (newest first) by checking the titles
    const allResults = await getPosts(10);
    // Posts are ordered by created_at DESC, so the last inserted should be first
    // Since we inserted them in order 1,2,3,4,5, the newest (Post 5) should be first
    expect(allResults[0].title).toEqual('Post 5'); // Most recent
    expect(allResults[4].title).toEqual('Post 1'); // Oldest
  });

  it('should handle posts with null latitude and longitude', async () => {
    // Create a user
    const users = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const user = users[0];

    // Create post without coordinates
    await db.insert(postsTable)
      .values({
        user_id: user.id,
        title: 'Lost item',
        description: 'Lost something without location',
        type: 'lost',
        category: 'other',
        contact_info: 'contact@example.com'
      })
      .execute();

    const result = await getPosts();

    expect(result).toHaveLength(1);
    expect(result[0].latitude).toBeNull();
    expect(result[0].longitude).toBeNull();
  });

  it('should use default pagination values when not provided', async () => {
    // Create a user
    const users = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const user = users[0];

    // Create 25 posts (more than default limit of 20)
    const postData = Array.from({ length: 25 }, (_, i) => ({
      user_id: user.id,
      title: `Post ${i + 1}`,
      description: `Description for post ${i + 1}`,
      type: 'lost' as const,
      category: 'other' as const,
      contact_info: 'contact@example.com'
    }));

    await db.insert(postsTable)
      .values(postData)
      .execute();

    // Call without parameters - should default to limit=20, offset=0
    const result = await getPosts();

    expect(result).toHaveLength(20); // Default limit
  });

  it('should handle multiple posts with different users', async () => {
    // Create two users
    const user1 = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashed_password',
        first_name: 'Alice',
        last_name: 'Johnson',
        preferred_language: 'en'
      })
      .returning()
      .execute();

    const user2 = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashed_password',
        first_name: 'Bob',
        last_name: 'Wilson',
        preferred_language: 'ar'
      })
      .returning()
      .execute();

    // Create posts for both users
    await db.insert(postsTable)
      .values([
        {
          user_id: user1[0].id,
          title: 'Alice lost keys',
          description: 'Keys lost by Alice',
          type: 'lost',
          category: 'other',
          contact_info: 'alice@example.com'
        },
        {
          user_id: user2[0].id,
          title: 'Bob found phone',
          description: 'Phone found by Bob',
          type: 'found',
          category: 'electronics',
          contact_info: 'bob@example.com'
        }
      ])
      .execute();

    const result = await getPosts();

    expect(result).toHaveLength(2);

    // Check that each post has correct user information
    const bobPost = result.find(p => p.title === 'Bob found phone');
    const alicePost = result.find(p => p.title === 'Alice lost keys');

    expect(bobPost).toBeDefined();
    expect(bobPost!.user.first_name).toEqual('Bob');
    expect(bobPost!.user.last_name).toEqual('Wilson');

    expect(alicePost).toBeDefined();
    expect(alicePost!.user.first_name).toEqual('Alice');
    expect(alicePost!.user.last_name).toEqual('Johnson');
  });
});