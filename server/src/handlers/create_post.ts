import { db } from '../db';
import { postsTable, postImagesTable, usersTable } from '../db/schema';
import { type CreatePostInput, type PostWithImages } from '../schema';
import { eq } from 'drizzle-orm';

export const createPost = async (input: CreatePostInput): Promise<PostWithImages> => {
  try {
    // 1. Validate the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // 2. Create the post record
    const postResult = await db.insert(postsTable)
      .values({
        user_id: input.user_id,
        title: input.title,
        description: input.description,
        type: input.type,
        category: input.category,
        location_text: input.location_text || null,
        latitude: input.latitude ? input.latitude.toString() : null, // Convert number to string for numeric column
        longitude: input.longitude ? input.longitude.toString() : null, // Convert number to string for numeric column
        contact_info: input.contact_info
      })
      .returning()
      .execute();

    const createdPost = postResult[0];

    // 3. Create associated image records if provided
    let images: any[] = [];
    if (input.images && input.images.length > 0) {
      const imageInserts = input.images.map((img, index) => ({
        post_id: createdPost.id,
        image_url: img.image_url,
        alt_text: img.alt_text || null,
        order_index: index
      }));

      images = await db.insert(postImagesTable)
        .values(imageInserts)
        .returning()
        .execute();
    }

    // 4. Return the created post with images and user information
    return {
      ...createdPost,
      latitude: createdPost.latitude ? parseFloat(createdPost.latitude) : null, // Convert string back to number
      longitude: createdPost.longitude ? parseFloat(createdPost.longitude) : null, // Convert string back to number
      images: images,
      user: {
        id: user[0].id,
        first_name: user[0].first_name,
        last_name: user[0].last_name
      }
    };
  } catch (error) {
    console.error('Post creation failed:', error);
    throw error;
  }
};