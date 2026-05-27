/**
 * Generated API stubs — replaced by `npx convex dev`.
 */
import type { FunctionReference } from 'convex/server';
export type WorkspaceDoc = {
    _id: string;
    _creationTime: number;
    name: string;
    ownerId: string;
    createdAt: number;
    role: 'owner' | 'editor';
};
export type MemberDoc = {
    _id: string;
    userId: string;
    role: 'owner' | 'editor';
    email: string | null;
    name: string | null;
};
export type PendingInviteDoc = {
    _id: string;
    workspaceId: string;
    email: string;
    invitedBy: string;
    createdAt: number;
    expiresAt: number;
};
export declare const api: {
    workspaces: {
        listMine: FunctionReference<'query', 'public', Record<string, never>, WorkspaceDoc[]>;
        getById: FunctionReference<'query', 'public', {
            workspaceId: string;
        }, WorkspaceDoc | null>;
        create: FunctionReference<'mutation', 'public', {
            name: string;
        }, string>;
        rename: FunctionReference<'mutation', 'public', {
            workspaceId: string;
            name: string;
        }, void>;
    };
    members: {
        list: FunctionReference<'query', 'public', {
            workspaceId: string;
        }, MemberDoc[]>;
        listPendingInvites: FunctionReference<'query', 'public', {
            workspaceId: string;
        }, PendingInviteDoc[]>;
        invite: FunctionReference<'mutation', 'public', {
            workspaceId: string;
            email: string;
        }, string>;
        remove: FunctionReference<'mutation', 'public', {
            workspaceId: string;
            userId: string;
        }, void>;
        acceptPendingInvites: FunctionReference<'mutation', 'public', Record<string, never>, void>;
    };
};
export declare const internal: typeof api;
