import { Routes, Route, Outlet } from "react-router-dom";
import { useState } from "react";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import { RequireAdmin, RequireAuth } from "./components/common/ProtectedRoute";
import ScrollToTopButton from "./components/common/ScrollToTopButton";
import AskAiPanel from "./components/ask/AskAiPanel";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import DocumentDetailPage from "./pages/DocumentDetailPage";
import BlogPage from "./pages/BlogPage";
import BlogDetailPage from "./pages/BlogDetailPage";
import CreateBlogPage from "./pages/CreateBlogPage";
import FaqPage from "./pages/FaqPage";
import AboutPage from "./pages/AboutPage";
import LoginPage from "./pages/LoginPage";
import AskPage from "./pages/AskPage";
import ProfilePage from "./pages/ProfilePage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSources from "./pages/admin/AdminSources";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminVersions from "./pages/admin/AdminVersions";
import AdminIngest from "./pages/admin/AdminIngest";
import AdminArticles from "./pages/admin/AdminArticles";
import AdminPipeline from "./pages/admin/AdminPipeline";
import AdminSchedules from "./pages/admin/AdminSchedules";
import AdminApprovals from "./pages/admin/AdminApprovals";
import AdminFeedback from "./pages/admin/AdminFeedback";
import NotFoundPage from "./pages/NotFoundPage";

function SiteLayout() {
  const [isAskOpen, setIsAskOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <Navbar onAskClick={() => setIsAskOpen(true)} />
      <main className="relative z-10">
        <Outlet />
      </main>
      <Footer />
      <ScrollToTopButton />
      <AskAiPanel open={isAskOpen} onClose={() => setIsAskOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/disease-search" element={<SearchPage />} />
        <Route path="/documents/:documentId" element={<DocumentDetailPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/blog/new" element={<CreateBlogPage />} />
        </Route>
        <Route path="/blog/:articleId" element={<BlogDetailPage />} />
        <Route path="/articles/:articleId" element={<BlogDetailPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/ask" element={<AskPage />} />
          <Route path="/chat" element={<AskPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
      </Route>

      <Route element={<RequireAdmin />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="sources" element={<AdminSources />} />
          <Route path="documents" element={<AdminDocuments />} />
          <Route path="versions" element={<AdminVersions />} />
          <Route path="ingest" element={<AdminIngest />} />
          <Route path="articles" element={<AdminArticles />} />
          <Route path="pipeline" element={<AdminPipeline />} />
          <Route path="schedules" element={<AdminSchedules />} />
          <Route path="approvals" element={<AdminApprovals />} />
          <Route path="feedback" element={<AdminFeedback />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
