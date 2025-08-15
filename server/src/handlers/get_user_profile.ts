import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';
import { eq } from 'drizzle-orm';

export const getUserProfile = async (userId: number): Promise<User> => {
  try {
    // Query the user by ID from the database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    // Check if user was found
    if (users.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const user = users[0];

    // Return user data - note that password_hash is included in the schema
    // but in a real application, you might want to exclude it depending on use case
    return {
      id: user.id,
      email: user.email,
      password_hash: user.password_hash,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      preferred_language: user.preferred_language,
      is_verified: user.is_verified,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    throw error;
  }
};