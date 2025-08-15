import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, postImagesTable } from '../db/schema';
import { getPostsByLocation } from '../handlers/get_posts_by_location';

// Test data for Beirut area coordinates
const beirutLat = 33.8938;
const beirutLng = 35.5018;

// Create test user
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashedpassword',
  first_name: 'John',
  last_name: 'Doe',
  preferred_language: 'en' as const,
  is_verified: true
};

// Create test posts with different locations
const testPosts = [
  {
    title: 'Lost wallet downtown',
    description: 'Lost my wallet near downtown Beirut',
    type: 'lost' as const,
    category: 'other' as const,
    location_text: 'Downtown Beirut',
    latitude: '33.8938', // Downtown Beirut - exact center
    longitude: '35.5018',
    contact_info: '+961123456789',
    status: 'active' as const
  },
  {
    title: 'Found phone nearby',
    description: 'Found iPhone near Hamra',
    type: 'found' as const,
    category: 'electronics' as const,
    location_text: 'Hamra Street',
    latitude: '33.8985', // ~0.5km from center
    longitude: '35.4825',
    contact_info: '+961987654321',
    status: 'active' as const
  },
  {
    title: 'Lost car far away',
    description: 'Lost my car in Tripoli',
    type: 'lost' as const,
    category: 'car' as const,
    location_text: 'Tripoli',
    latitude: '34.4361', // ~80km from Beirut
    longitude: '35.8497',
    contact_info: '+961111111111',
    status: 'active' as const
  },
  {
    title: 'Inactive post',
    description: 'This post is closed',
    type: 'found' as const,
    category: 'other' as const,
    location_text: 'Downtown Beirut',
    latitude: '33.8938',
    longitude: '35.5018',
    contact_info: '+961222222222',
    status: 'closed' as const // Inactive status
  },
  {
    title: 'No location data',
    description: 'Post without coordinates',
    type: 'lost' as const,
    category: 'documents' as const,
    location_text: 'Somewhere',
    latitude: null,
    longitude: null,
    contact_info: '+961333333333',
    status: 'active' as const
  }
];

describe('getPostsByLocation', () => {
  let userId: number;
  let postIds: number[] = [];

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    userId = userResult[0].id;

    // Create test posts
    for (const postData of testPosts) {
      const postResult = await db.insert(postsTable)
        .values({
          ...postData,
          user_id: userId
        })
        .returning()
        .execute();
      
      postIds.push(postResult[0].id);
    }

    // Add some test images to the first post
    await db.insert(postImagesTable)
      .values([
        {
          post_id: postIds[0],
          image_url: 'https://example.com/image1.jpg',
          alt_text: 'Image 1',
          order_index: 0
        },
        {
          post_id: postIds[0],
          image_url: 'https://example.com/image2.jpg',
          alt_text: 'Image 2',
          order_index: 1
        }
      ])
      .execute();
  });

  afterEach(resetDB);

  it('should return posts within specified radius', async () => {
    const results = await getPostsByLocation(beirutLat, beirutLng, 10); // 10km radius

    expect(results).toHaveLength(2); // Downtown and Hamra posts
    
    // Check that returned posts are within radius and active
    results.forEach(post => {
      expect(post.status).toBe('active');
      expect(post.latitude).not.toBeNull();
      expect(post.longitude).not.toBeNull();
    });

    // Downtown post should be first (closest)
    expect(results[0].title).toBe('Lost wallet downtown');
    expect(results[1].title).toBe('Found phone nearby');
  });

  it('should exclude posts outside radius', async () => {
    const results = await getPostsByLocation(beirutLat, beirutLng, 5); // 5km radius

    expect(results).toHaveLength(2); // Only downtown and nearby posts
    
    const titles = results.map(post => post.title);
    expect(titles).not.toContain('Lost car far away'); // Tripoli post should be excluded
  });

  it('should exclude posts without coordinates', async () => {
    const results = await getPostsByLocation(beirutLat, beirutLng, 100); // Large radius

    const titles = results.map(post => post.title);
    expect(titles).not.toContain('No location data'); // Post without coordinates excluded
  });

  it('should exclude inactive posts', async () => {
    const results = await getPostsByLocation(beirutLat, beirutLng, 10);

    const titles = results.map(post => post.title);
    expect(titles).not.toContain('Inactive post'); // Closed post excluded
  });

  it('should apply limit correctly', async () => {
    const results = await getPostsByLocation(beirutLat, beirutLng, 100, 1); // Limit to 1

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Lost wallet downtown'); // Closest post
  });

  it('should include post images', async () => {
    const results = await getPostsByLocation(beirutLat, beirutLng, 10);

    const postWithImages = results.find(post => post.title === 'Lost wallet downtown');
    expect(postWithImages).toBeDefined();
    expect(postWithImages!.images).toHaveLength(2);
    
    expect(postWithImages!.images[0].image_url).toBe('https://example.com/image1.jpg');
    expect(postWithImages!.images[0].alt_text).toBe('Image 1');
    expect(postWithImages!.images[0].order_index).toBe(0);
    
    expect(postWithImages!.images[1].image_url).toBe('https://example.com/image2.jpg');
    expect(postWithImages!.images[1].alt_text).toBe('Image 2');
    expect(postWithImages!.images[1].order_index).toBe(1);
  });

  it('should include user information', async () => {
    const results = await getPostsByLocation(beirutLat, beirutLng, 10);

    results.forEach(post => {
      expect(post.user).toBeDefined();
      expect(post.user.id).toBe(userId);
      expect(post.user.first_name).toBe('John');
      expect(post.user.last_name).toBe('Doe');
    });
  });

  it('should convert numeric coordinates to numbers', async () => {
    const results = await getPostsByLocation(beirutLat, beirutLng, 10);

    results.forEach(post => {
      if (post.latitude !== null && post.longitude !== null) {
        expect(typeof post.latitude).toBe('number');
        expect(typeof post.longitude).toBe('number');
      }
    });

    // Check specific values
    const downtownPost = results.find(post => post.title === 'Lost wallet downtown');
    expect(downtownPost!.latitude).toBe(33.8938);
    expect(downtownPost!.longitude).toBe(35.5018);
  });

  it('should order posts by distance from center', async () => {
    const results = await getPostsByLocation(beirutLat, beirutLng, 100);

    // Downtown post (exact center) should be first
    expect(results[0].title).toBe('Lost wallet downtown');
    expect(results[0].latitude).toBe(33.8938);
    expect(results[0].longitude).toBe(35.5018);

    // Hamra post (~0.5km away) should be second
    expect(results[1].title).toBe('Found phone nearby');

    // Tripoli post (~80km away) should be last
    expect(results[results.length - 1].title).toBe('Lost car far away');
  });

  it('should handle empty results correctly', async () => {
    // Search in the middle of the ocean - no posts should be found
    const results = await getPostsByLocation(0, 0, 10);

    expect(results).toHaveLength(0);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should handle posts without images', async () => {
    const results = await getPostsByLocation(beirutLat, beirutLng, 10);

    const postWithoutImages = results.find(post => post.title === 'Found phone nearby');
    expect(postWithoutImages).toBeDefined();
    expect(postWithoutImages!.images).toHaveLength(0);
    expect(Array.isArray(postWithoutImages!.images)).toBe(true);
  });
});