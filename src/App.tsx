import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import Index from "./pages/Index";
import Builder from "./pages/Builder";
import Grade from "./pages/Grade";
import HorizontalGrade from "./pages/HorizontalGrade";
import Results from "./pages/Results";
import NotFound from "./pages/NotFound";
import StudentAssessmentPage from "./pages/StudentAssessmentPage";
import StudentSessionPage from "./pages/StudentSessionPage";
import RubricDashboard from "./pages/RubricDashboard";

const queryClient = new QueryClient();

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import { Navigate, Outlet } from "react-router-dom";

// Protected Route Wrapper
const ProtectedRoute = () => {
  const { session, isGuest, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!session && !isGuest) return <Navigate to="/login" replace />;

  return <Outlet />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SpeedInsights />
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/student/session/:sessionId" element={<StudentSessionPage />} />
              <Route path="/student/:rubricId" element={<StudentAssessmentPage />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Index />} />
                <Route path="/builder" element={<Builder />} />
                <Route path="/rubric/:rubricId" element={<RubricDashboard />} />
                <Route path="/grade/:rubricId" element={<Grade />} />
                <Route path="/grade/:rubricId/horizontal" element={<HorizontalGrade />} />
                <Route path="/results" element={<Results />} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
