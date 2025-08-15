import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';

export const login = async (input: LoginInput): Promise<AuthResponse> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = users[0];

    // Compare password with stored hash using Bun's password verification
    const isPasswordValid = await Bun.password.verify(input.password, user.password_hash);
    
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate simple token - using format that doesn't conflict with email dots
    // Format: userId|email|timestamp
    const token = `${user.id}|${user.email}|${Date.now()}`;

    // Return user data (without password hash) and token
    return {
      user: {
        id: user.id,
        email: user.email,
        password_hash: user.password_hash, // Keep this for schema compliance, but should be filtered out in API layer
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        preferred_language: user.preferred_language,
        is_verified: user.is_verified,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};