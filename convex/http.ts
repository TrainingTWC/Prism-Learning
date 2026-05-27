import { httpRouter } from 'convex/server';
import { auth } from './auth';

const http = httpRouter();

// Mount Convex Auth's HTTP routes (magic link callback, session refresh, etc.)
auth.addHttpRoutes(http);

export default http;
