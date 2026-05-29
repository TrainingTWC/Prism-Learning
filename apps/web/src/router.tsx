import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
} from '@tanstack/react-router';
import { AppLayout } from './components/AppLayout';
import { MobileGuard } from './components/MobileGuard';
import { SignInPage } from './pages/SignInPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { MembersPage } from './pages/MembersPage';
import { RendererDemoPage } from './pages/RendererDemoPage';
import { ModuleListPage } from './pages/ModuleListPage';
import { ModuleEditorPage } from './pages/ModuleEditorPage';
import { ThemeEditorPage } from './pages/ThemeEditorPage';
import { PreviewPage } from './pages/PreviewPage';
import { BuildWithAIPage } from './pages/BuildWithAIPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

// Root — wraps everything in the mobile guard
const rootRoute = createRootRoute({
  component: () => (
    <MobileGuard>
      <Outlet />
    </MobileGuard>
  ),
});

// Public routes
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  component: SignInPage,
});

// Protected layout — enforces auth
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  component: AppLayout,
});

// Dashboard — workspace list
const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/',
  component: DashboardPage,
});

// Workspace content shell
const workspaceRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/w/$workspaceId',
  component: WorkspacePage,
});

// Members panel
const membersRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/w/$workspaceId/members',
  component: MembersPage,
});

// Module list for a workspace
const moduleListRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/w/$workspaceId/modules',
  component: ModuleListPage,
});

// Module editor
const moduleEditorRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/w/$workspaceId/m/$moduleId',
  component: ModuleEditorPage,
});

// Theme editor
const themeEditorRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/w/$workspaceId/theme',
  component: ThemeEditorPage,
});

// Build with AI
const buildWithAIRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/w/$workspaceId/build-with-ai',
  component: BuildWithAIPage,
});

// Analytics intelligence
const analyticsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/w/$workspaceId/analytics',
  component: AnalyticsPage,
});

// Learner preview
const previewRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/w/$workspaceId/m/$moduleId/preview',
  component: PreviewPage,
});

// Public dev-only renderer demo (Phase 2 purity proof)
const rendererDemoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/renderer-demo',
  component: RendererDemoPage,
});

const routeTree = rootRoute.addChildren([
  signInRoute,
  rendererDemoRoute,
  protectedRoute.addChildren([dashboardRoute, workspaceRoute, membersRoute, moduleListRoute, moduleEditorRoute, themeEditorRoute, buildWithAIRoute, analyticsRoute, previewRoute]),
]);

export const router = createRouter({ routeTree });

// TypeScript route registration (required by TanStack Router)
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
