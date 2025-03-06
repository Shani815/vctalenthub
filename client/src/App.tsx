import { Redirect, Route, Switch } from "wouter";

import AdminDashboard from "./pages/AdminDashboard";
import AdminLayout from "./components/AdminLayout";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import HighlightsPage from "./pages/HighlightsPage";
import HirePage from "./pages/HirePage";
import HomePage from "./pages/HomePage";
import JobBoardPage from "./pages/JobBoardPage";
import { Loader2 } from "lucide-react";
import ManageJobsPage from "./pages/ManageJobsPage";
import { ManageReferralCodePage } from "./pages/ManageReferralCodePage";
import ManageUsersPage from "./pages/ManageUsersPage";
import { MessageWindow } from "./components/MessageWindow";
import Navbar from "./components/Navbar";
import NetworkPage from "./pages/NetworkPage";
import { OnboardingDialog } from "./components/OnboardingDialog";
import PricingPage from "./pages/PricingPage";
import ProfilePage from "./pages/ProfilePage";
import { QueryClientProvider } from "@tanstack/react-query";
import SettingsPage from "./pages/SettingsPage";
import SocialFeedPage from "./pages/SocialFeedPage";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "./lib/queryClient";
import { useUser } from "./hooks/use-user";

// Protected Route Component
function ProtectedRoute({ component: Component, adminOnly = false, layout: Layout = ({ children }: { children: React.ReactNode }) => <>{children}</>, ...rest }: any) {
  const { user } = useUser();

  if (!user) {
    return <Redirect to="/" />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Redirect to="/" />;
  }

  return (
    <Layout>
      <Component {...rest} />
    </Layout>
  );
}

function App() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {!user.hasCompletedOnboarding && <OnboardingDialog />}
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/network" component={NetworkPage} />
        <Route path="/feed" component={SocialFeedPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/profile/:id" component={ProfilePage} />
        <Route path="/highlights" component={HighlightsPage} />
        <Route path="/pricing" component={PricingPage} />
        {(user.role === 'startup' || user.role === 'venture_capitalist') ? (
          <Route path="/hire" component={HirePage} />
        ) : (
          <Route path="/jobs" component={JobBoardPage} />
        )}

        {/* Admin Routes with Layout */}
        <Route path="/admin">
          <ProtectedRoute component={AdminDashboard} adminOnly layout={AdminLayout} />
        </Route>
        <Route path="/admin/users">
          <ProtectedRoute component={ManageUsersPage} adminOnly layout={AdminLayout} />
        </Route>
        <Route path="/admin/jobs">
          <ProtectedRoute component={ManageJobsPage} adminOnly layout={AdminLayout} />
        </Route>
        <Route path="/admin/manage-referral-code">
          <ProtectedRoute component={ManageReferralCodePage} adminOnly layout={AdminLayout} />
        </Route>
        <Route path="/admin/:section">
          <ProtectedRoute component={AdminDashboard} adminOnly layout={AdminLayout} />
        </Route>
      </Switch>
      <MessageWindow />
      <Toaster />
    </div>
  );
}

export default App;