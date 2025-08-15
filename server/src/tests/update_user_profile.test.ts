import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserProfileInput, type RegisterInput } from '../schema';
import { updateUserProfile } from '../handlers/update_user_profile';
import { eq } from 'drizzle-orm';
// Helper to create a test user
const createTestUser = async () => {
  const result = await db.insert(usersTable)
    .values({
      email: 'test@example.com',
      password_hash: 'hashed_password_123',
      first_name: 'John',
      last_name: 'Doe',
      phone: '+1234567890',
      preferred_language: 'en' as const,
      is_verified: false
    })
    .returning()
    .execute();

  return result[0];
};

describe('updateUserProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update user profile with all fields', async () => {
    const user = await createTestUser();

    const updateInput: UpdateUserProfileInput = {
      id: user.id,
      first_name: 'Jane',
      last_name: 'Smith',
      phone: '+0987654321',
      preferred_language: 'ar'
    };

    const result = await updateUserProfile(updateInput);

    // Verify the returned data
    expect(result.id).toBe(user.id);
    expect(result.first_name).toBe('Jane');
    expect(result.last_name).toBe('Smith');
    expect(result.phone).toBe('+0987654321');
    expect(result.preferred_language).toBe('ar');
    expect(result.email).toBe(user.email); // Unchanged
    expect(result.is_verified).toBe(user.is_verified); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > user.updated_at).toBe(true);
  });

  it('should update only specific fields when provided', async () => {
    const user = await createTestUser();

    const updateInput: UpdateUserProfileInput = {
      id: user.id,
      first_name: 'Jane'
    };

    const result = await updateUserProfile(updateInput);

    // Verify updated field
    expect(result.first_name).toBe('Jane');
    
    // Verify unchanged fields
    expect(result.last_name).toBe(user.last_name);
    expect(result.phone).toBe(user.phone);
    expect(result.preferred_language).toBe(user.preferred_language);
    expect(result.email).toBe(user.email);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > user.updated_at).toBe(true);
  });

  it('should update phone to null', async () => {
    const user = await createTestUser();

    const updateInput: UpdateUserProfileInput = {
      id: user.id,
      phone: null
    };

    const result = await updateUserProfile(updateInput);

    expect(result.phone).toBeNull();
    expect(result.first_name).toBe(user.first_name); // Unchanged
    expect(result.last_name).toBe(user.last_name); // Unchanged
    expect(result.updated_at > user.updated_at).toBe(true);
  });

  it('should save updated user to database', async () => {
    const user = await createTestUser();

    const updateInput: UpdateUserProfileInput = {
      id: user.id,
      first_name: 'UpdatedName',
      preferred_language: 'ar'
    };

    await updateUserProfile(updateInput);

    // Verify database was updated
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(updatedUser).toHaveLength(1);
    expect(updatedUser[0].first_name).toBe('UpdatedName');
    expect(updatedUser[0].preferred_language).toBe('ar');
    expect(updatedUser[0].last_name).toBe(user.last_name); // Unchanged
    expect(updatedUser[0].updated_at).toBeInstanceOf(Date);
    expect(updatedUser[0].updated_at > user.updated_at).toBe(true);
  });

  it('should throw error when user does not exist', async () => {
    const updateInput: UpdateUserProfileInput = {
      id: 99999,
      first_name: 'NonExistent'
    };

    await expect(updateUserProfile(updateInput)).rejects.toThrow(/User with id 99999 not found/i);
  });

  it('should update user with minimum input', async () => {
    const user = await createTestUser();

    const updateInput: UpdateUserProfileInput = {
      id: user.id
    };

    const result = await updateUserProfile(updateInput);

    // All original data should remain the same except updated_at
    expect(result.id).toBe(user.id);
    expect(result.first_name).toBe(user.first_name);
    expect(result.last_name).toBe(user.last_name);
    expect(result.phone).toBe(user.phone);
    expect(result.preferred_language).toBe(user.preferred_language);
    expect(result.email).toBe(user.email);
    expect(result.is_verified).toBe(user.is_verified);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > user.updated_at).toBe(true);
  });

  it('should handle language preference change correctly', async () => {
    const user = await createTestUser();

    const updateInput: UpdateUserProfileInput = {
      id: user.id,
      preferred_language: 'ar'
    };

    const result = await updateUserProfile(updateInput);

    expect(result.preferred_language).toBe('ar');
    
    // Verify in database
    const dbUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(dbUser[0].preferred_language).toBe('ar');
  });

  it('should preserve sensitive fields unchanged', async () => {
    const user = await createTestUser();

    const updateInput: UpdateUserProfileInput = {
      id: user.id,
      first_name: 'NewName'
    };

    const result = await updateUserProfile(updateInput);

    // Sensitive/immutable fields should remain unchanged
    expect(result.email).toBe(user.email);
    expect(result.password_hash).toBe(user.password_hash);
    expect(result.is_verified).toBe(user.is_verified);
    expect(result.created_at).toEqual(user.created_at);
  });
});