import { db } from '../db';
import { postsTable, usersTable, postImagesTable } from '../db/schema';
import { type PostWithImages } from '../schema';
import { desc, eq, inArray } from 'drizzle-orm';

export const getPosts = async (limit?: number, offset?: number): Promise<PostWithImages[]> => {
  try {
    // Set default values for pagination
    const defaultLimit = limit ?? 20;
    const defaultOffset = offset ?? 0;

    // Query posts with user information, ordered by newest first
    const postsWithUsers = await db.select({
      post: postsTable,
      user: {
        id: usersTable.id,
        first_name: usersTable.first_name,
        last_name: usersTable.last_name
      }
    })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.user_id, usersTable.id))
    .orderBy(desc(postsTable.created_at))
    .limit(defaultLimit)
    .offset(defaultOffset)
    .execute();

    // If no posts, return empty array
    if (postsWithUsers.length === 0) {
      return [];
    }

    // Query all images for the posts we retrieved
    const postIds = postsWithUsers.map(result => result.post.id);
    
    const images = await db.select()
      .from(postImagesTable)
      .where(inArray(postImagesTable.post_id, postIds))
      .execute();

    // Group images by post_id
    const imagesByPostId = images.reduce((acc, image) => {
      if (!acc[image.post_id]) {
        acc[image.post_id] = [];
      }
      acc[image.post_id].push(image);
      return acc;
    }, {} as Record<number, typeof images>);

    // Combine posts with their images and convert numeric fields
    return postsWithUsers.map(result => ({
      ...result.post,
      latitude: result.post.latitude ? parseFloat(result.post.latitude) : null,
      longitude: result.post.longitude ? parseFloat(result.post.longitude) : null,
      images: (imagesByPostId[result.post.id] || []).sort((a, b) => a.order_index - b.order_index),
      user: result.user
    }));
  } catch (error) {
    console.error('Failed to get posts:', error);
    throw error;
  }
};