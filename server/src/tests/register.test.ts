import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterInput } from '../schema';
import { register } from '../handlers/register';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const TOKEN_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';

// Test input data
const testInput: RegisterInput = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  preferred_language: 'en'
};

describe('register', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user successfully', async () => {
    const result = await register(testInput);

    // Verify return structure
    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');

    // Verify user data
    expect(result.user.email).toEqual(testInput.email);
    expect(result.user.first_name).toEqual(testInput.first_name);
    expect(result.user.last_name).toEqual(testInput.last_name);
    expect(result.user.phone).toEqual(testInput.phone || null);
    expect(result.user.preferred_language).toEqual(testInput.preferred_language);
    expect(result.user.is_verified).toBe(false);
    expect(result.user.id).toBeDefined();
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database with hashed password', async () => {
    const result = await register(testInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];

    // Verify all fields are saved correctly
    expect(savedUser.email).toEqual(testInput.email);
    expect(savedUser.first_name).toEqual(testInput.first_name);
    expect(savedUser.last_name).toEqual(testInput.last_name);
    expect(savedUser.phone).toEqual(testInput.phone || null);
    expect(savedUser.preferred_language).toEqual(testInput.preferred_language);
    expect(savedUser.is_verified).toBe(false);

    // Verify password is hashed (not plain text)
    expect(savedUser.password_hash).not.toEqual(testInput.password);
    expect(savedUser.password_hash).toContain(':'); // Should contain salt separator

    // Verify hashed password can be verified
    const [hash, salt] = savedUser.password_hash.split(':');
    const expectedHash = crypto.pbkdf2Sync(testInput.password, salt, 10000, 64, 'sha256').toString('hex');
    expect(hash).toEqual(expectedHash);
  });

  it('should generate valid token', async () => {
    const result = await register(testInput);

    // Verify token structure
    expect(result.token).toContain('.');
    const [signature, payload] = result.token.split('.');
    
    // Decode payload
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    expect(decoded.userId).toEqual(result.user.id);
    expect(decoded.email).toEqual(result.user.email);
    expect(decoded.exp).toBeDefined(); // Should have expiration
    
    // Verify signature
    const expectedSignature = crypto.createHmac('sha256', TOKEN_SECRET).update(Buffer.from(payload, 'base64').toString()).digest('hex');
    expect(signature).toEqual(expectedSignature);
  });

  it('should reject duplicate email registration', async () => {
    // Register first user
    await register(testInput);

    // Try to register with same email
    await expect(register(testInput))
      .rejects.toThrow(/email already registered/i);
  });

  it('should handle user without phone number', async () => {
    const inputWithoutPhone: RegisterInput = {
      email: 'nophone@example.com',
      password: 'password123',
      first_name: 'Jane',
      last_name: 'Smith',
      preferred_language: 'ar'
    };

    const result = await register(inputWithoutPhone);

    expect(result.user.phone).toBeNull();
    expect(result.user.preferred_language).toEqual('ar');

    // Verify in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    expect(users[0].phone).toBeNull();
  });

  it('should handle Arabic language preference', async () => {
    const arabicInput: RegisterInput = {
      email: 'arabic@example.com',
      password: 'password123',
      first_name: 'أحمد',
      last_name: 'محمد',
      phone: '+966501234567',
      preferred_language: 'ar'
    };

    const result = await register(arabicInput);

    expect(result.user.preferred_language).toEqual('ar');
    expect(result.user.first_name).toEqual('أحمد');
    expect(result.user.last_name).toEqual('محمد');
  });

  it('should set default verification status to false', async () => {
    const result = await register(testInput);

    expect(result.user.is_verified).toBe(false);

    // Verify in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    expect(users[0].is_verified).toBe(false);
  });
});