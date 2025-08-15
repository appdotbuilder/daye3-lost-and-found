import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable(),
  preferred_language: z.enum(['ar', 'en']),
  is_verified: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Post schema
export const postSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string(),
  description: z.string(),
  type: z.enum(['lost', 'found']),
  category: z.enum(['person', 'car', 'furniture', 'electronics', 'documents', 'jewelry', 'clothing', 'other']),
  location_text: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  contact_info: z.string(),
  status: z.enum(['active', 'resolved', 'closed']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Post = z.infer<typeof postSchema>;

// Post image schema
export const postImageSchema = z.object({
  id: z.number(),
  post_id: z.number(),
  image_url: z.string(),
  alt_text: z.string().nullable(),
  order_index: z.number().int(),
  created_at: z.coerce.date()
});

export type PostImage = z.infer<typeof postImageSchema>;

// Message schema
export const messageSchema = z.object({
  id: z.number(),
  conversation_id: z.number(),
  sender_id: z.number(),
  content: z.string(),
  is_read: z.boolean(),
  created_at: z.coerce.date()
});

export type Message = z.infer<typeof messageSchema>;

// Conversation schema
export const conversationSchema = z.object({
  id: z.number(),
  post_id: z.number(),
  user1_id: z.number(),
  user2_id: z.number(),
  last_message_at: z.coerce.date(),
  created_at: z.coerce.date()
});

export type Conversation = z.infer<typeof conversationSchema>;

// Input schemas for authentication
export const registerInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().nullable().optional(),
  preferred_language: z.enum(['ar', 'en'])
});

export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Input schemas for posts
export const createPostInputSchema = z.object({
  user_id: z.number(),
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(['lost', 'found']),
  category: z.enum(['person', 'car', 'furniture', 'electronics', 'documents', 'jewelry', 'clothing', 'other']),
  location_text: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  contact_info: z.string().min(1),
  images: z.array(z.object({
    image_url: z.string(),
    alt_text: z.string().nullable().optional()
  })).optional()
});

export type CreatePostInput = z.infer<typeof createPostInputSchema>;

export const updatePostInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  location_text: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  contact_info: z.string().min(1).optional(),
  status: z.enum(['active', 'resolved', 'closed']).optional()
});

export type UpdatePostInput = z.infer<typeof updatePostInputSchema>;

// Search schema
export const searchInputSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['lost', 'found']).optional(),
  category: z.enum(['person', 'car', 'furniture', 'electronics', 'documents', 'jewelry', 'clothing', 'other']).optional(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radius_km: z.number().positive().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

export type SearchInput = z.infer<typeof searchInputSchema>;

// Message input schemas
export const sendMessageInputSchema = z.object({
  conversation_id: z.number(),
  sender_id: z.number(),
  content: z.string().min(1)
});

export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

export const createConversationInputSchema = z.object({
  post_id: z.number(),
  user1_id: z.number(),
  user2_id: z.number()
});

export type CreateConversationInput = z.infer<typeof createConversationInputSchema>;

// User profile update schema
export const updateUserProfileInputSchema = z.object({
  id: z.number(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  preferred_language: z.enum(['ar', 'en']).optional()
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileInputSchema>;

// Response schemas
export const authResponseSchema = z.object({
  user: userSchema,
  token: z.string()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const postWithImagesSchema = postSchema.extend({
  images: z.array(postImageSchema),
  user: userSchema.pick({
    id: true,
    first_name: true,
    last_name: true
  })
});

export type PostWithImages = z.infer<typeof postWithImagesSchema>;

export const conversationWithMessagesSchema = conversationSchema.extend({
  messages: z.array(messageSchema),
  post: postSchema.pick({
    id: true,
    title: true,
    type: true
  }),
  other_user: userSchema.pick({
    id: true,
    first_name: true,
    last_name: true
  })
});

export type ConversationWithMessages = z.infer<typeof conversationWithMessagesSchema>;