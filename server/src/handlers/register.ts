import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const TOKEN_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';

export const register = async (input: RegisterInput): Promise<AuthResponse> => {
  try {
    // 1. Check if email already exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUsers.length > 0) {
      throw new Error('Email already registered');
    }

    // 2. Hash the password using Node.js crypto
    const salt = crypto.randomBytes(16).toString('hex');
    const password_hash = crypto.pbkdf2Sync(input.password, salt, 10000, 64, 'sha256').toString('hex') + ':' + salt;

    // 3. Create user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash,
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone || null,
        preferred_language: input.preferred_language,
        is_verified: false
      })
      .returning()
      .execute();

    const user = result[0];

    // 4. Generate simple token (in production, use proper JWT)
    const tokenPayload = JSON.stringify({ userId: user.id, email: user.email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    const token = crypto.createHmac('sha256', TOKEN_SECRET).update(tokenPayload).digest('hex') + '.' + Buffer.from(tokenPayload).toString('base64');

    // 5. Return user data (without password hash) and token
    return {
      user: {
        id: user.id,
        email: user.email,
        password_hash: user.password_hash, // Keep for schema compliance, but shouldn't be used
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
    console.error('Registration failed:', error);
    throw error;
  }
};