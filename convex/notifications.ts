import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { internalMutation, mutation, query } from './_generated/server';

type NotificationKind = Doc<'notifications'>['kind'];

export const createForUser = internalMutation({
  args: {
    userId: v.id('users'),
    kind: v.union(
      v.literal('workspace_invite_sent'),
      v.literal('workspace_joined'),
      v.literal('ai_module_built'),
    ),
    title: v.string(),
    body: v.string(),
    workspaceId: v.optional(v.id('workspaces')),
    moduleId: v.optional(v.id('modules')),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert('notifications', {
      userId: args.userId,
      kind: args.kind,
      title: args.title,
      body: args.body,
      workspaceId: args.workspaceId,
      moduleId: args.moduleId,
      createdAt: now,
    });
  },
});

function toClientNotification(notification: Doc<'notifications'>) {
  return {
    ...notification,
    isRead: !!notification.readAt,
  };
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        items: [] as Array<ReturnType<typeof toClientNotification>>,
        unreadCount: 0,
      };
    }

    const notifications = await ctx.db
      .query('notifications')
      .withIndex('by_user_and_createdAt', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();

    const items = notifications.slice(0, 20).map(toClientNotification);
    const unreadCount = notifications.reduce((count, notification) => count + (notification.readAt ? 0 : 1), 0);

    return { items, unreadCount };
  },
});

async function getOwnedNotification(ctx: MutationCtx, notificationId: Id<'notifications'>) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error('Unauthenticated');

  const notification = await ctx.db.get(notificationId);
  if (!notification || notification.userId !== userId) throw new Error('Not found');
  return notification;
}

export const markRead = mutation({
  args: { notificationId: v.id('notifications') },
  handler: async (ctx, { notificationId }) => {
    const notification = await getOwnedNotification(ctx, notificationId);
    if (notification.readAt) return;
    await ctx.db.patch(notificationId, { readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthenticated');

    const notifications = await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    const now = Date.now();
    await Promise.all(
      notifications
        .filter((notification) => !notification.readAt)
        .map((notification) => ctx.db.patch(notification._id, { readAt: now })),
    );
  },
});

export const remove = mutation({
  args: { notificationId: v.id('notifications') },
  handler: async (ctx, { notificationId }) => {
    await getOwnedNotification(ctx, notificationId);
    await ctx.db.delete(notificationId);
  },
});