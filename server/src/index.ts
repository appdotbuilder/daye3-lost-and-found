import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  registerInputSchema,
  loginInputSchema,
  createPostInputSchema,
  updatePostInputSchema,
  searchInputSchema,
  sendMessageInputSchema,
  createConversationInputSchema,
  updateUserProfileInputSchema,
} from './schema';

// Import handlers
import { register } from './handlers/register';
import { login } from './handlers/login';
import { getUserProfile } from './handlers/get_user_profile';
import { updateUserProfile } from './handlers/update_user_profile';
import { createPost } from './handlers/create_post';
import { getPosts } from './handlers/get_posts';
import { getPostById } from './handlers/get_post_by_id';
import { updatePost } from './handlers/update_post';
import { searchPosts } from './handlers/search_posts';
import { createConversation } from './handlers/create_conversation';
import { sendMessage } from './handlers/send_message';
import { getConversations } from './handlers/get_conversations';
import { getConversationMessages } from './handlers/get_conversation_messages';
import { markMessagesRead } from './handlers/mark_messages_read';
import { getPostsByLocation } from './handlers/get_posts_by_location';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  register: publicProcedure
    .input(registerInputSchema)
    .mutation(({ input }) => register(input)),

  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),

  // User profile routes
  getUserProfile: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserProfile(input.userId)),

  updateUserProfile: publicProcedure
    .input(updateUserProfileInputSchema)
    .mutation(({ input }) => updateUserProfile(input)),

  // Post routes
  createPost: publicProcedure
    .input(createPostInputSchema)
    .mutation(({ input }) => createPost(input)),

  getPosts: publicProcedure
    .input(z.object({
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
    }).optional())
    .query(({ input }) => getPosts(input?.limit, input?.offset)),

  getPostById: publicProcedure
    .input(z.object({ postId: z.number() }))
    .query(({ input }) => getPostById(input.postId)),

  updatePost: publicProcedure
    .input(updatePostInputSchema)
    .mutation(({ input }) => updatePost(input)),

  searchPosts: publicProcedure
    .input(searchInputSchema)
    .query(({ input }) => searchPosts(input)),

  getPostsByLocation: publicProcedure
    .input(z.object({
      latitude: z.number(),
      longitude: z.number(),
      radiusKm: z.number().positive(),
      limit: z.number().int().positive().optional(),
    }))
    .query(({ input }) => getPostsByLocation(input.latitude, input.longitude, input.radiusKm, input.limit)),

  // Messaging routes
  createConversation: publicProcedure
    .input(createConversationInputSchema)
    .mutation(({ input }) => createConversation(input)),

  sendMessage: publicProcedure
    .input(sendMessageInputSchema)
    .mutation(({ input }) => sendMessage(input)),

  getConversations: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getConversations(input.userId)),

  getConversationMessages: publicProcedure
    .input(z.object({
      conversationId: z.number(),
      userId: z.number(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
    }))
    .query(({ input }) => getConversationMessages(input.conversationId, input.userId, input.limit, input.offset)),

  markMessagesRead: publicProcedure
    .input(z.object({
      conversationId: z.number(),
      userId: z.number(),
    }))
    .mutation(({ input }) => markMessagesRead(input.conversationId, input.userId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();