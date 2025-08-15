import { db } from '../db';
import { postsTable, postImagesTable, usersTable } from '../db/schema';
import { type SearchInput, type PostWithImages } from '../schema';
import { eq, and, or, ilike, desc, sql, type SQL, isNotNull, inArray } from 'drizzle-orm';

export const searchPosts = async (input: SearchInput): Promise<PostWithImages[]> => {
  try {
    // Start with base query joining posts with users
    let query = db.select({
      post: postsTable,
      user: {
        id: usersTable.id,
        first_name: usersTable.first_name,
        last_name: usersTable.last_name
      }
    })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.user_id, usersTable.id));

    // Build conditions array for WHERE clause
    const conditions: SQL<unknown>[] = [];

    // Only search active posts by default
    conditions.push(eq(postsTable.status, 'active'));

    // Text search on title and description
    if (input.query) {
      const textCondition = or(
        ilike(postsTable.title, `%${input.query}%`),
        ilike(postsTable.description, `%${input.query}%`)
      );
      if (textCondition) {
        conditions.push(textCondition);
      }
    }

    // Filter by post type (lost/found)
    if (input.type) {
      conditions.push(eq(postsTable.type, input.type));
    }

    // Filter by category
    if (input.category) {
      conditions.push(eq(postsTable.category, input.category));
    }

    // Location-based filtering
    if (input.location) {
      conditions.push(ilike(postsTable.location_text, `%${input.location}%`));
    }

    // Radius-based search using coordinates
    if (input.latitude && input.longitude && input.radius_km) {
      // Use Haversine formula for distance calculation
      const earthRadiusKm = 6371;
      const distanceFormula = sql`
        ${earthRadiusKm} * acos(
          cos(radians(${input.latitude})) * 
          cos(radians(${postsTable.latitude})) * 
          cos(radians(${postsTable.longitude}) - radians(${input.longitude})) + 
          sin(radians(${input.latitude})) * 
          sin(radians(${postsTable.latitude}))
        )
      `;
      
      const locationConditions = and(
        isNotNull(postsTable.latitude),
        isNotNull(postsTable.longitude),
        sql`${distanceFormula} <= ${input.radius_km}`
      );
      
      if (locationConditions) {
        conditions.push(locationConditions);
      }
    }

    // Apply WHERE conditions - always apply a where clause to maintain type consistency
    const whereCondition = conditions.length === 0 ? 
      sql`1 = 1` : // Always true condition when no filters
      (conditions.length === 1 ? conditions[0] : and(...conditions));
    
    // Build final query with all clauses
    const limit = input.limit || 20;
    const offset = input.offset || 0;
    
    const finalQuery = query
      .where(whereCondition)
      .orderBy(desc(postsTable.created_at))
      .limit(limit)
      .offset(offset);

    // Execute the main query
    const results = await finalQuery.execute();

    // If no results, return empty array
    if (results.length === 0) {
      return [];
    }

    // Get post IDs for fetching images
    const postIds = results.map(result => result.post.id);

    // Fetch images for all posts in a single query
    const images = await db.select()
      .from(postImagesTable)
      .where(inArray(postImagesTable.post_id, postIds))
      .orderBy(postImagesTable.order_index)
      .execute();

    // Group images by post_id
    const imagesByPostId = images.reduce((acc, image) => {
      if (!acc[image.post_id]) {
        acc[image.post_id] = [];
      }
      acc[image.post_id].push(image);
      return acc;
    }, {} as Record<number, typeof images>);

    // Transform results to PostWithImages format
    return results.map(result => ({
      ...result.post,
      // Convert numeric fields back to numbers
      latitude: result.post.latitude ? parseFloat(result.post.latitude) : null,
      longitude: result.post.longitude ? parseFloat(result.post.longitude) : null,
      images: imagesByPostId[result.post.id] || [],
      user: result.user
    }));
  } catch (error) {
    console.error('Post search failed:', error);
    throw error;
  }
};