/**
 * Copyright (c) Caiden Sanders and his affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Prisma Imports
import { Follow, Prisma } from '@prisma/client';
import { Context } from '../utils/context';

// Subscription Imports
import { pubSub } from '../utils/apollo-server';
import { MESSAGE_CREATED, NEW_CONVERSATION } from '../constants/Subscriptions';

const Query = {
  /**
   * Gets user's specific conversation
   *
   * @param {string} authUserId
   * @param {string} userId
   */
  getMessages: async (parent: any, args: any, ctx: Context) => {
    const specificMessage = ctx.prisma.message.findMany({
      where: {
        AND: [
          {
            OR: [{ senderId: args.authUserId }, { receiver: args.authUserId }],
          },
          {
            OR: [{ senderId: args.userId }, { receiver: args.userId }],
          },
        ],
      },
      select: {
        id: true,
        message: true,
        seen: true,
        sender: true,
        receiver: true,
        createdAt: true,
      },
    });

    return specificMessage;
  },

  /**
   * Get users with whom authUser had a conversation
   *
   * @param {string} authUserId
   */
  getConversations: async (parent: any, args: any, ctx: Context) => {
    // Get users with whom authUser had a chat
    const authUser = await ctx.prisma.user.findUnique({
      where: { id: args.authUserId },
      select: {
        messages: true,
      },
    });

    if (authUser === null) return;

    // Get last messages with wom authUser had a chat
    const lastMessages = await ctx.prisma.message.findMany({
      where: {
        OR: [{ receiver: args.authUserId }, { sender: args.authUserId }],
      },
    });

    // Attach message properties to users
    const conversations: any = [];
    authUser.messages.map(async (u) => {
      let oppositeId;
      if (u.userId === args.authUserId) oppositeId = u.senderId;
      else oppositeId = u.userId;

      const otherUser = await ctx.prisma.user.findUnique({
        where: { id: oppositeId },
        select: {
          id: true,
          username: true,
          fullName: true,
          image: true,
          isOnline: true,
        },
      });

      if (otherUser === null) return;

      const user: {
        id: string;
        username: string;
        fullName: string;
        image: string;
        isOnline: boolean;
        seen: undefined | boolean;
        lastMessageCreatedAt: undefined | Date;
        lastMessage: undefined | string;
        lastMessageSender: undefined | boolean;
      } = {
        id: otherUser.id,
        username: otherUser.username,
        fullName: otherUser.fullName,
        image: otherUser.image,
        isOnline: otherUser.isOnline,
        seen: undefined,
        lastMessageCreatedAt: undefined,
        lastMessage: undefined,
        lastMessageSender: undefined,
      };

      const sender = lastMessages.find((m) => u.id === m.senderId.toString());
      if (sender) {
        user.seen = sender.seen;
        user.lastMessageCreatedAt = sender.createdAt;
        user.lastMessage = sender.message;
        user.lastMessageSender = false;
      } else {
        const receiver = lastMessages.find((m) => u.id === m.userId.toString());

        if (receiver) {
          user.seen = receiver.seen;
          user.lastMessageCreatedAt = receiver.createdAt;
          user.lastMessage = receiver.message;
          user.lastMessageSender = true;
        }
      }

      conversations.push(user);
    });

    // Sort users by last created messages date
    const sortedConversations = conversations.sort(
      (a: { lastMessageCreatedAt: Date }, b: { lastMessageCreatedAt: Date }) =>
        b.lastMessageCreatedAt
          .toString()
          .localeCompare(a.lastMessageCreatedAt.toString()),
    );

    return sortedConversations;
  },
};

const Mutation = {};

const Subscription = {};

export default { Query, Mutation, Subscription };