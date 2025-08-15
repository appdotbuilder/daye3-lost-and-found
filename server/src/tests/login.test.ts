import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { login } from '../handlers/login';

// Test user data
const testUser = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  preferred_language: 'en' as const,
  is_verified: true
};

const testInput: LoginInput = {
  email: testUser.email,
  password: testUser.password
};

describe('login', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should authenticate user with valid credentials', async () => {
    // Create test user with hashed password using Bun's password hashing
    const passwordHash = await Bun.password.hash(testUser.password);
    
    const result = await db.insert(usersTable)
      .values({
        email: testUser.email,
        first_name: testUser.first_name,
        last_name: testUser.last_name,
        phone: testUser.phone,
        preferred_language: testUser.preferred_language,
        is_verified: testUser.is_verified,
        password_hash: passwordHash
      })
      .returning()
      .execute();

    const createdUser = result[0];

    // Attempt login
    const loginResult = await login(testInput);

    // Verify response structure
    expect(loginResult.user).toBeDefined();
    expect(loginResult.token).toBeDefined();

    // Verify user data
    expect(loginResult.user.id).toEqual(createdUser.id);
    expect(loginResult.user.email).toEqual(testUser.email);
    expect(loginResult.user.first_name).toEqual(testUser.first_name);
    expect(loginResult.user.last_name).toEqual(testUser.last_name);
    expect(loginResult.user.phone).toEqual(testUser.phone);
    expect(loginResult.user.preferred_language).toEqual(testUser.preferred_language);
    expect(loginResult.user.is_verified).toEqual(testUser.is_verified);
    expect(loginResult.user.created_at).toBeInstanceOf(Date);
    expect(loginResult.user.updated_at).toBeInstanceOf(Date);

    // Verify token is valid
    expect(typeof loginResult.token).toBe('string');
    expect(loginResult.token.length).toBeGreaterThan(0);

    // Verify token contains user information (simple format: id|email|timestamp)
    const tokenParts = loginResult.token.split('|');
    expect(tokenParts.length).toEqual(3);
    expect(parseInt(tokenParts[0])).toEqual(createdUser.id);
    expect(tokenParts[1]).toEqual(testUser.email);
    expect(parseInt(tokenParts[2])).toBeGreaterThan(0); // Timestamp should be positive
  });

  it('should throw error for non-existent email', async () => {
    const invalidInput: LoginInput = {
      email: 'nonexistent@example.com',
      password: 'password123'
    };

    await expect(login(invalidInput)).rejects.toThrow(/invalid credentials/i);
  });

  it('should throw error for incorrect password', async () => {
    // Create test user
    const passwordHash = await Bun.password.hash(testUser.password);
    
    await db.insert(usersTable)
      .values({
        email: testUser.email,
        first_name: testUser.first_name,
        last_name: testUser.last_name,
        phone: testUser.phone,
        preferred_language: testUser.preferred_language,
        is_verified: testUser.is_verified,
        password_hash: passwordHash
      })
      .execute();

    const invalidInput: LoginInput = {
      email: testUser.email,
      password: 'wrongpassword'
    };

    await expect(login(invalidInput)).rejects.toThrow(/invalid credentials/i);
  });

  it('should handle case-sensitive email correctly', async () => {
    // Create test user with lowercase email
    const passwordHash = await Bun.password.hash(testUser.password);
    
    await db.insert(usersTable)
      .values({
        email: testUser.email.toLowerCase(),
        first_name: testUser.first_name,
        last_name: testUser.last_name,
        phone: testUser.phone,
        preferred_language: testUser.preferred_language,
        is_verified: testUser.is_verified,
        password_hash: passwordHash
      })
      .execute();

    // Try login with uppercase email
    const uppercaseEmailInput: LoginInput = {
      email: testUser.email.toUpperCase(),
      password: testUser.password
    };

    // Should fail because emails are case-sensitive in this implementation
    await expect(login(uppercaseEmailInput)).rejects.toThrow(/invalid credentials/i);
  });

  it('should work with different user data combinations', async () => {
    // Test with minimal user data (no phone)
    const minimalUser = {
      email: 'minimal@example.com',
      password: 'testpass123',
      first_name: 'Jane',
      last_name: 'Smith',
      phone: null,
      preferred_language: 'ar' as const,
      is_verified: false
    };

    const passwordHash = await Bun.password.hash(minimalUser.password);
    
    const result = await db.insert(usersTable)
      .values({
        email: minimalUser.email,
        first_name: minimalUser.first_name,
        last_name: minimalUser.last_name,
        phone: minimalUser.phone,
        preferred_language: minimalUser.preferred_language,
        is_verified: minimalUser.is_verified,
        password_hash: passwordHash
      })
      .returning()
      .execute();

    const createdUser = result[0];

    const loginInput: LoginInput = {
      email: minimalUser.email,
      password: minimalUser.password
    };

    const loginResult = await login(loginInput);

    expect(loginResult.user.email).toEqual(minimalUser.email);
    expect(loginResult.user.phone).toBeNull();
    expect(loginResult.user.preferred_language).toEqual('ar');
    expect(loginResult.user.is_verified).toEqual(false);
    expect(loginResult.token).toBeDefined();

    // Verify token contains user information
    const tokenParts = loginResult.token.split('|');
    expect(tokenParts.length).toEqual(3);
    expect(parseInt(tokenParts[0])).toEqual(createdUser.id);
    expect(tokenParts[1]).toEqual(minimalUser.email);
  });

  it('should generate unique tokens for different login sessions', async () => {
    // Create test user
    const passwordHash = await Bun.password.hash(testUser.password);
    
    await db.insert(usersTable)
      .values({
        email: testUser.email,
        first_name: testUser.first_name,
        last_name: testUser.last_name,
        phone: testUser.phone,
        preferred_language: testUser.preferred_language,
        is_verified: testUser.is_verified,
        password_hash: passwordHash
      })
      .execute();

    // Add small delay to ensure different timestamps
    const loginResult1 = await login(testInput);
    await new Promise(resolve => setTimeout(resolve, 1));
    const loginResult2 = await login(testInput);

    // Tokens should be different (they contain timestamp)
    expect(loginResult1.token).not.toEqual(loginResult2.token);

    // But both should contain same user data
    const token1Parts = loginResult1.token.split('|');
    const token2Parts = loginResult2.token.split('|');

    expect(token1Parts[0]).toEqual(token2Parts[0]); // Same user ID
    expect(token1Parts[1]).toEqual(token2Parts[1]); // Same email
    expect(parseInt(token1Parts[2])).toBeLessThan(parseInt(token2Parts[2])); // Different timestamps
  });
});