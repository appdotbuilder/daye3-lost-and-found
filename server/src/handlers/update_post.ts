import { db } from '../db';
import { postsTable, postImagesTable, usersTable } from '../db/schema';
import { type UpdatePostInput, type PostWithImages } from '../schema';
import { eq } from 'drizzle-orm';

export const updatePost = async (input: UpdatePostInput): Promise<PostWithImages> => {
  try {
    // Check if post exists
    const existingPost = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, input.id))
      .execute();

    if (existingPost.length === 0) {
      throw new Error('Post not found');
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.title !== undefined) {
      updateData.title = input.title;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.location_text !== undefined) {
      updateData.location_text = input.location_text;
    }
    if (input.latitude !== undefined) {
      updateData.latitude = input.latitude ? input.latitude.toString() : null;
    }
    if (input.longitude !== undefined) {
      updateData.longitude = input.longitude ? input.longitude.toString() : null;
    }
    if (input.contact_info !== undefined) {
      updateData.contact_info = input.contact_info;
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    // Update the post
    const updatedPosts = await db.update(postsTable)
      .set(updateData)
      .where(eq(postsTable.id, input.id))
      .returning()
      .execute();

    const updatedPost = updatedPosts[0];

    // Get post images
    const images = await db.select()
      .from(postImagesTable)
      .where(eq(postImagesTable.post_id, input.id))
      .orderBy(postImagesTable.order_index)
      .execute();

    // Get user information
    const users = await db.select({
      id: usersTable.id,
      first_name: usersTable.first_name,
      last_name: usersTable.last_name
    })
      .from(usersTable)
      .where(eq(usersTable.id, updatedPost.user_id))
      .execute();

    const user = users[0];

    // Convert numeric fields back to numbers and return
    return {
      ...updatedPost,
      latitude: updatedPost.latitude ? parseFloat(updatedPost.latitude) : null,
      longitude: updatedPost.longitude ? parseFloat(updatedPost.longitude) : null,
      images,
      user
    };
  } catch (error) {
    console.error('Post update failed:', error);
    throw error;
  }
};