import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, postImagesTable } from '../db/schema';
import { type SearchInput } from '../schema';
import { searchPosts } from '../handlers/search_posts';

describe('searchPosts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup helper
  const setupTestData = async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@example.com',
          password_hash: 'hash1',
          first_name: 'John',
          last_name: 'Doe',
          preferred_language: 'en'
        },
        {
          email: 'user2@example.com',
          password_hash: 'hash2',
          first_name: 'Jane',
          last_name: 'Smith',
          preferred_language: 'ar'
        }
      ])
      .returning()
      .execute();

    // Create test posts
    const posts = await db.insert(postsTable)
      .values([
        {
          user_id: users[0].id,
          title: 'Lost iPhone 14',
          description: 'Lost my black iPhone 14 near the mall',
          type: 'lost',
          category: 'electronics',
          location_text: 'City Mall',
          latitude: '33.8938',
          longitude: '35.5018',
          contact_info: '+961123456789',
          status: 'active'
        },
        {
          user_id: users[1].id,
          title: 'Found wallet',
          description: 'Found a brown leather wallet with ID cards',
          type: 'found',
          category: 'other',
          location_text: 'Downtown Beirut',
          latitude: '33.8869',
          longitude: '35.5131',
          contact_info: '+961987654321',
          status: 'active'
        },
        {
          user_id: users[0].id,
          title: 'Lost car keys',
          description: 'Honda car keys with blue keychain',
          type: 'lost',
          category: 'other',
          location_text: 'Hamra Street',
          latitude: '33.8979',
          longitude: '35.4851',
          contact_info: '+961123456789',
          status: 'resolved'  // This should not appear in active searches
        },
        {
          user_id: users[1].id,
          title: 'Found cat',
          description: 'Orange tabby cat, very friendly',
          type: 'found',
          category: 'other',
          location_text: 'Achrafieh',
          contact_info: '+961987654321',
          status: 'active'
        }
      ])
      .returning()
      .execute();

    // Create test images
    await db.insert(postImagesTable)
      .values([
        {
          post_id: posts[0].id,
          image_url: 'https://example.com/iphone.jpg',
          alt_text: 'Lost iPhone',
          order_index: 0
        },
        {
          post_id: posts[0].id,
          image_url: 'https://example.com/iphone2.jpg',
          alt_text: 'iPhone back view',
          order_index: 1
        },
        {
          post_id: posts[1].id,
          image_url: 'https://example.com/wallet.jpg',
          alt_text: 'Found wallet',
          order_index: 0
        }
      ])
      .execute();

    return { users, posts };
  };

  it('should return all active posts without filters', async () => {
    await setupTestData();

    const input: SearchInput = {};
    const results = await searchPosts(input);

    expect(results).toHaveLength(3); // Only active posts
    expect(results.every(post => post.status === 'active')).toBe(true);
    expect(results[0].user).toBeDefined();
    expect(results[0].user.first_name).toBeDefined();
  });

  it('should search posts by text query', async () => {
    await setupTestData();

    const input: SearchInput = {
      query: 'iPhone'
    };
    const results = await searchPosts(input);

    expect(results).toHaveLength(1);
    expect(results[0].title).toContain('iPhone');
    expect(results[0].images).toHaveLength(2); // Should include images
  });

  it('should search posts by description text', async () => {
    await setupTestData();

    const input: SearchInput = {
      query: 'leather'
    };
    const results = await searchPosts(input);

    expect(results).toHaveLength(1);
    expect(results[0].description).toContain('leather');
  });

  it('should filter by post type', async () => {
    await setupTestData();

    const lostInput: SearchInput = {
      type: 'lost'
    };
    const lostResults = await searchPosts(lostInput);
    expect(lostResults).toHaveLength(1); // Only active lost post
    expect(lostResults.every(post => post.type === 'lost')).toBe(true);

    const foundInput: SearchInput = {
      type: 'found'
    };
    const foundResults = await searchPosts(foundInput);
    expect(foundResults).toHaveLength(2); // Two active found posts
    expect(foundResults.every(post => post.type === 'found')).toBe(true);
  });

  it('should filter by category', async () => {
    await setupTestData();

    const input: SearchInput = {
      category: 'electronics'
    };
    const results = await searchPosts(input);

    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('electronics');
    expect(results[0].title).toContain('iPhone');
  });

  it('should filter by location text', async () => {
    await setupTestData();

    const input: SearchInput = {
      location: 'Mall'
    };
    const results = await searchPosts(input);

    expect(results).toHaveLength(1);
    expect(results[0].location_text).toContain('Mall');
  });

  it('should convert numeric coordinates correctly', async () => {
    await setupTestData();

    const input: SearchInput = {};
    const results = await searchPosts(input);

    const postsWithCoords = results.filter(post => post.latitude && post.longitude);
    expect(postsWithCoords.length).toBeGreaterThan(0);
    
    postsWithCoords.forEach(post => {
      expect(typeof post.latitude).toBe('number');
      expect(typeof post.longitude).toBe('number');
      expect(post.latitude).toBeGreaterThan(0);
      expect(post.longitude).toBeGreaterThan(0);
    });
  });

  it('should perform radius-based search', async () => {
    await setupTestData();

    // Search within 5km of City Mall coordinates
    const input: SearchInput = {
      latitude: 33.8938,
      longitude: 35.5018,
      radius_km: 5
    };
    const results = await searchPosts(input);

    expect(results.length).toBeGreaterThan(0);
    // All results should have coordinates (since we filtered by distance)
    expect(results.every(post => post.latitude !== null && post.longitude !== null)).toBe(true);
  });

  it('should exclude posts outside radius', async () => {
    await setupTestData();

    // Search with very small radius that should exclude most posts
    const input: SearchInput = {
      latitude: 33.8938,
      longitude: 35.5018,
      radius_km: 0.1  // 100 meters
    };
    const results = await searchPosts(input);

    // Should find the exact location match (City Mall post)
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('should apply pagination correctly', async () => {
    await setupTestData();

    const firstPageInput: SearchInput = {
      limit: 2,
      offset: 0
    };
    const firstPage = await searchPosts(firstPageInput);
    expect(firstPage).toHaveLength(2);

    const secondPageInput: SearchInput = {
      limit: 2,
      offset: 2
    };
    const secondPage = await searchPosts(secondPageInput);
    expect(secondPage).toHaveLength(1); // Only 1 remaining post

    // Ensure no overlap between pages
    const firstPageIds = firstPage.map(post => post.id);
    const secondPageIds = secondPage.map(post => post.id);
    expect(firstPageIds.some(id => secondPageIds.includes(id))).toBe(false);
  });

  it('should combine multiple filters', async () => {
    await setupTestData();

    const input: SearchInput = {
      type: 'found',
      query: 'wallet',
      location: 'Downtown'
    };
    const results = await searchPosts(input);

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('found');
    expect(results[0].description).toContain('wallet');
    expect(results[0].location_text).toContain('Downtown');
  });

  it('should return empty array when no posts match', async () => {
    await setupTestData();

    const input: SearchInput = {
      query: 'nonexistent item'
    };
    const results = await searchPosts(input);

    expect(results).toHaveLength(0);
  });

  it('should order results by creation date (most recent first)', async () => {
    await setupTestData();

    const input: SearchInput = {};
    const results = await searchPosts(input);

    expect(results.length).toBeGreaterThan(1);
    
    // Check that results are ordered by created_at in descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].created_at.getTime()).toBeGreaterThanOrEqual(
        results[i].created_at.getTime()
      );
    }
  });

  it('should include user information correctly', async () => {
    const { users } = await setupTestData();

    const input: SearchInput = {};
    const results = await searchPosts(input);

    expect(results.length).toBeGreaterThan(0);
    results.forEach(post => {
      expect(post.user).toBeDefined();
      expect(post.user.id).toBeDefined();
      expect(post.user.first_name).toBeDefined();
      expect(post.user.last_name).toBeDefined();
      
      // Verify user data matches expected users
      const matchingUser = users.find(u => u.id === post.user.id);
      expect(matchingUser).toBeDefined();
      expect(post.user.first_name).toBe(matchingUser!.first_name);
    });
  });

  it('should handle posts without coordinates in radius search', async () => {
    await setupTestData();

    // The cat post doesn't have coordinates
    const input: SearchInput = {
      latitude: 33.8938,
      longitude: 35.5018,
      radius_km: 10,
      query: 'cat'
    };
    const results = await searchPosts(input);

    // Should not find the cat post since it has no coordinates
    expect(results).toHaveLength(0);
  });
});