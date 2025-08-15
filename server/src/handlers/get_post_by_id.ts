import { db } from '../db';
import { postsTable, usersTable, postImagesTable } from '../db/schema';
import { type PostWithImages } from '../schema';
import { eq } from 'drizzle-orm';

export const getPostById = async (postId: number): Promise<PostWithImages | null> => {
  try {
    // Query post with user information
    const postResults = await db.select({
      post: postsTable,
      user: {
        id: usersTable.id,
        first_name: usersTable.first_name,
        last_name: usersTable.last_name
      }
    })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.user_id, usersTable.id))
    .where(eq(postsTable.id, postId))
    .execute();

    if (postResults.length === 0) {
      return null;
    }

    const postData = postResults[0];

    // Query associated images
    const images = await db.select()
      .from(postImagesTable)
      .where(eq(postImagesTable.post_id, postId))
      .orderBy(postImagesTable.order_index)
      .execute();

    // Convert numeric fields and build result
    return {
      ...postData.post,
      latitude: postData.post.latitude ? parseFloat(postData.post.latitude) : null,
      longitude: postData.post.longitude ? parseFloat(postData.post.longitude) : null,
      images: images,
      user: postData.user
    };
  } catch (error) {
    console.error('Failed to get post by ID:', error);
    throw error;
  }
};