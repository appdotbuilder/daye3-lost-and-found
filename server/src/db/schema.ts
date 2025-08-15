import { serial, text, pgTable, timestamp, boolean, integer, numeric, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const languageEnum = pgEnum('language', ['ar', 'en']);
export const postTypeEnum = pgEnum('post_type', ['lost', 'found']);
export const categoryEnum = pgEnum('category', ['person', 'car', 'furniture', 'electronics', 'documents', 'jewelry', 'clothing', 'other']);
export const postStatusEnum = pgEnum('post_status', ['active', 'resolved', 'closed']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  phone: text('phone'),
  preferred_language: languageEnum('preferred_language').notNull().default('en'),
  is_verified: boolean('is_verified').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Posts table
export const postsTable = pgTable('posts', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: postTypeEnum('type').notNull(),
  category: categoryEnum('category').notNull(),
  location_text: text('location_text'),
  latitude: numeric('latitude', { precision: 10, scale: 8 }),
  longitude: numeric('longitude', { precision: 11, scale: 8 }),
  contact_info: text('contact_info').notNull(),
  status: postStatusEnum('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Post images table
export const postImagesTable = pgTable('post_images', {
  id: serial('id').primaryKey(),
  post_id: integer('post_id').notNull().references(() => postsTable.id, { onDelete: 'cascade' }),
  image_url: text('image_url').notNull(),
  alt_text: text('alt_text'),
  order_index: integer('order_index').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Conversations table
export const conversationsTable = pgTable('conversations', {
  id: serial('id').primaryKey(),
  post_id: integer('post_id').notNull().references(() => postsTable.id),
  user1_id: integer('user1_id').notNull().references(() => usersTable.id),
  user2_id: integer('user2_id').notNull().references(() => usersTable.id),
  last_message_at: timestamp('last_message_at').defaultNow().notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Messages table
export const messagesTable = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversation_id: integer('conversation_id').notNull().references(() => conversationsTable.id, { onDelete: 'cascade' }),
  sender_id: integer('sender_id').notNull().references(() => usersTable.id),
  content: text('content').notNull(),
  is_read: boolean('is_read').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  posts: many(postsTable),
  sentMessages: many(messagesTable),
  conversations1: many(conversationsTable, { relationName: 'user1_conversations' }),
  conversations2: many(conversationsTable, { relationName: 'user2_conversations' }),
}));

export const postsRelations = relations(postsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [postsTable.user_id],
    references: [usersTable.id],
  }),
  images: many(postImagesTable),
  conversations: many(conversationsTable),
}));

export const postImagesRelations = relations(postImagesTable, ({ one }) => ({
  post: one(postsTable, {
    fields: [postImagesTable.post_id],
    references: [postsTable.id],
  }),
}));

export const conversationsRelations = relations(conversationsTable, ({ one, many }) => ({
  post: one(postsTable, {
    fields: [conversationsTable.post_id],
    references: [postsTable.id],
  }),
  user1: one(usersTable, {
    fields: [conversationsTable.user1_id],
    references: [usersTable.id],
    relationName: 'user1_conversations',
  }),
  user2: one(usersTable, {
    fields: [conversationsTable.user2_id],
    references: [usersTable.id],
    relationName: 'user2_conversations',
  }),
  messages: many(messagesTable),
}));

export const messagesRelations = relations(messagesTable, ({ one }) => ({
  conversation: one(conversationsTable, {
    fields: [messagesTable.conversation_id],
    references: [conversationsTable.id],
  }),
  sender: one(usersTable, {
    fields: [messagesTable.sender_id],
    references: [usersTable.id],
  }),
}));

// TypeScript types for the tables
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Post = typeof postsTable.$inferSelect;
export type NewPost = typeof postsTable.$inferInsert;
export type PostImage = typeof postImagesTable.$inferSelect;
export type NewPostImage = typeof postImagesTable.$inferInsert;
export type Conversation = typeof conversationsTable.$inferSelect;
export type NewConversation = typeof conversationsTable.$inferInsert;
export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  posts: postsTable,
  postImages: postImagesTable,
  conversations: conversationsTable,
  messages: messagesTable,
};