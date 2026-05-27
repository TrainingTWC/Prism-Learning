/**
 * Generated type stubs — replaced by `npx convex dev`.
 * These allow the web app to typecheck before a Convex deployment exists.
 */
import type { QueryBuilder, MutationBuilder, ActionBuilder } from 'convex/server';
import type { DataModel } from './dataModel';
export declare const query: QueryBuilder<DataModel, 'public'>;
export declare const mutation: MutationBuilder<DataModel, 'public'>;
export declare const action: ActionBuilder<DataModel, 'public'>;
export declare const internalQuery: QueryBuilder<DataModel, 'internal'>;
export declare const internalMutation: MutationBuilder<DataModel, 'internal'>;
export declare const internalAction: ActionBuilder<DataModel, 'internal'>;
