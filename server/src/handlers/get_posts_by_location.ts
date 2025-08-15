import { db } from '../db';
import { postsTable, usersTable, postImagesTable } from '../db/schema';
import { type PostWithImages } from '../schema';
import { eq, and, isNotNull, asc, sql, inArray } from 'drizzle-orm';

export const getPostsByLocation = async (
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit?: number
): Promise<PostWithImages[]> => {
  try {
    // Build base query with joins
    const baseQuery = db.select({
      // Post fields
      id: postsTable.id,
      user_id: postsTable.user_id,
      title: postsTable.title,
      description: postsTable.description,
      type: postsTable.type,
      category: postsTable.category,
      location_text: postsTable.location_text,
      latitude: postsTable.latitude,
      longitude: postsTable.longitude,
      contact_info: postsTable.contact_info,
      status: postsTable.status,
      created_at: postsTable.created_at,
      updated_at: postsTable.updated_at,
      // User fields
      user_id_user: usersTable.id,
      user_first_name: usersTable.first_name,
      user_last_name: usersTable.last_name
    })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.user_id, usersTable.id))
    .where(
      and(
        isNotNull(postsTable.latitude),
        isNotNull(postsTable.longitude),
        eq(postsTable.status, 'active'),
        // Filter by radius using Haversine formula
        sql`(
          6371 * acos(
            GREATEST(-1, LEAST(1,
              cos(radians(${latitude})) * 
              cos(radians(${postsTable.latitude})) * 
              cos(radians(${postsTable.longitude}) - radians(${longitude})) + 
              sin(radians(${latitude})) * 
              sin(radians(${postsTable.latitude}))
            ))
          )
        ) <= ${radiusKm}`
      )
    );

    // Apply limit to the base query
    const results = limit 
      ? await baseQuery.limit(limit).execute()
      : await baseQuery.execute();

    if (results.length === 0) {
      return [];
    }

    // Sort results by distance in JavaScript (since we filtered by radius already)
    const resultsWithDistance = results.map(result => {
      const lat1 = latitude;
      const lon1 = longitude;
      const lat2 = parseFloat(result.latitude!);
      const lon2 = parseFloat(result.longitude!);
      
      // Haversine formula for distance calculation
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      return { ...result, distance };
    });

    // Sort by distance
    resultsWithDistance.sort((a, b) => a.distance - b.distance);

    // Get post IDs for image lookup
    const postIds = resultsWithDistance.map(result => result.id);
    
    // Fetch images for all posts using inArray operator
    const images = await db.select()
      .from(postImagesTable)
      .where(inArray(postImagesTable.post_id, postIds))
      .orderBy(asc(postImagesTable.order_index))
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
    return resultsWithDistance.map(result => ({
      id: result.id,
      user_id: result.user_id,
      title: result.title,
      description: result.description,
      type: result.type,
      category: result.category,
      location_text: result.location_text,
      latitude: result.latitude ? parseFloat(result.latitude) : null,
      longitude: result.longitude ? parseFloat(result.longitude) : null,
      contact_info: result.contact_info,
      status: result.status,
      created_at: result.created_at,
      updated_at: result.updated_at,
      images: imagesByPostId[result.id] || [],
      user: {
        id: result.user_id_user,
        first_name: result.user_first_name,
        last_name: result.user_last_name
      }
    }));
  } catch (error) {
    console.error('Get posts by location failed:', error);
    throw error;
  }
};