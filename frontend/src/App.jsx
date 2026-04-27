import { Routes, Route, Outlet } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import { RequireAdmin, RequireAuth } from "./components/common/ProtectedRoute";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import DocumentDetailPage from "./pages/DocumentDetailPage";
import BlogPage from "./pages/BlogPage";
import ArticleDetailPage from "./pages/ArticleDetailPage";
import FaqPage from "./pages/FaqPage";
import AboutPage from "./pages/AboutPage";
import LoginPage from "./pages/LoginPage";
import AskPage from "./pages/AskPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSources from "./pages/admin/AdminSources";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminIngest from "./pages/admin/AdminIngest";
import AdminArticles from "./pages/admin/AdminArticles";
import AdminPipeline from "./pages/admin/AdminPipeline";
import NotFoundPage from "./pages/NotFoundPage";

function SiteLayout() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <Navbar />
      <main className="relative z-10">
        <Outlet />
      </main>
      <Footer />
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
        <Route path="/blog/:articleId" element={<ArticleDetailPage />} />
        <Route path="/articles/:articleId" element={<ArticleDetailPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/ask" element={<AskPage />} />
          <Route path="/chat" element={<AskPage />} />
        </Route>
      </Route>

      <Route element={<RequireAdmin />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="sources" element={<AdminSources />} />
          <Route path="documents" element={<AdminDocuments />} />
          <Route path="ingest" element={<AdminIngest />} />
          <Route path="articles" element={<AdminArticles />} />
          <Route path="pipeline" element={<AdminPipeline />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
