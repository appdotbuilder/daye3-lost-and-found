import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getUserProfile } from '../handlers/get_user_profile';

describe('getUserProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user profile by ID', async () => {
    // Create a test user
    const testUser = {
      email: 'test@example.com',
      password_hash: 'hashed_password_123',
      first_name: 'John',
      last_name: 'Doe',
      phone: '+1234567890',
      preferred_language: 'en' as const,
      is_verified: true
    };

    const createdUsers = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const createdUser = createdUsers[0];

    // Fetch user profile using the handler
    const result = await getUserProfile(createdUser.id);

    // Verify all fields are returned correctly
    expect(result.id).toEqual(createdUser.id);
    expect(result.email).toEqual('test@example.com');
    expect(result.password_hash).toEqual('hashed_password_123');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.phone).toEqual('+1234567890');
    expect(result.preferred_language).toEqual('en');
    expect(result.is_verified).toEqual(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should return user profile with null phone', async () => {
    // Create a test user with null phone
    const testUser = {
      email: 'test2@example.com',
      password_hash: 'hashed_password_456',
      first_name: 'Jane',
      last_name: 'Smith',
      phone: null,
      preferred_language: 'ar' as const,
      is_verified: false
    };

    const createdUsers = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const createdUser = createdUsers[0];

    // Fetch user profile using the handler
    const result = await getUserProfile(createdUser.id);

    // Verify fields including null phone
    expect(result.id).toEqual(createdUser.id);
    expect(result.email).toEqual('test2@example.com');
    expect(result.first_name).toEqual('Jane');
    expect(result.last_name).toEqual('Smith');
    expect(result.phone).toBeNull();
    expect(result.preferred_language).toEqual('ar');
    expect(result.is_verified).toEqual(false);
  });

  it('should throw error when user is not found', async () => {
    const nonExistentUserId = 999;

    // Attempt to fetch non-existent user should throw error
    expect(getUserProfile(nonExistentUserId)).rejects.toThrow(/User with ID 999 not found/i);
  });

  it('should handle multiple users correctly', async () => {
    // Create multiple test users
    const testUsers = [
      {
        email: 'user1@example.com',
        password_hash: 'hash1',
        first_name: 'User',
        last_name: 'One',
        preferred_language: 'en' as const
      },
      {
        email: 'user2@example.com',
        password_hash: 'hash2',
        first_name: 'User',
        last_name: 'Two',
        preferred_language: 'ar' as const
      }
    ];

    const createdUsers = await db.insert(usersTable)
      .values(testUsers)
      .returning()
      .execute();

    // Fetch each user individually
    const user1 = await getUserProfile(createdUsers[0].id);
    const user2 = await getUserProfile(createdUsers[1].id);

    // Verify correct users are returned
    expect(user1.email).toEqual('user1@example.com');
    expect(user1.first_name).toEqual('User');
    expect(user1.last_name).toEqual('One');
    expect(user1.preferred_language).toEqual('en');

    expect(user2.email).toEqual('user2@example.com');
    expect(user2.first_name).toEqual('User');
    expect(user2.last_name).toEqual('Two');
    expect(user2.preferred_language).toEqual('ar');

    // Verify they have different IDs
    expect(user1.id).not.toEqual(user2.id);
  });
});