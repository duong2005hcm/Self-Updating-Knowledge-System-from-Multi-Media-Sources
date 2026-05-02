import React, { useEffect, useMemo, useState } from "react";
import { checkHealth, searchKnowledge } from "../api/ragapi";
import KnowledgeFeatureCards from "./KnowledgeFeatureCards";
import KnowledgeFlowSection from "./KnowledgeFlowSection";
import KnowledgePreviewSection from "./KnowledgePreviewSection";
import KnowledgeSearchBar from "./KnowledgeSearchBar";
import "../styles/landing.css";

function formatUpdatedAt(value) {
  if (!value) return "Chưa có timestamp";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function LandingPage({
  user,
  onOpenWorkspace,
  onOpenAuth,
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [healthStatus, setHealthStatus] = useState("checking");

  useEffect(() => {
    let active = true;

    checkHealth()
      .then(() => {
        if (active) setHealthStatus("ready");
      })
      .catch(() => {
        if (active) setHealthStatus("degraded");
      });

    return () => {
      active = false;
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (healthStatus === "ready") return "Backend ready";
    if (healthStatus === "degraded") return "Backend unavailable";
    return "Checking backend";
  }, [healthStatus]);

  const handleSearch = async (nextQuery) => {
    const normalizedQuery = String(nextQuery || "").trim();
    setQuery(normalizedQuery);
    setHasSearched(true);
    setSearchError("");

    if (!normalizedQuery) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await searchKnowledge(normalizedQuery, {
        searchMode: "hybrid",
        limit: 4,
      });
      setSearchResults(response.items || []);
    } catch (error) {
      setSearchResults([]);
      setSearchError(error.message || "Không thể tải kết quả tìm kiếm.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="landing-page">
      <header className="landing-topbar">
        <div className="landing-brand">
          <div className="landing-brand-mark">
            <img src="/smilesi_ai.png" alt="SIMLESI AI" />
          </div>
          <div>
            <div className="landing-brand-title">SIMLESI AI</div>
            <div className="landing-brand-subtitle">Knowledge Platform</div>
          </div>
        </div>

        <div className="landing-topbar-actions">
          <span className={`landing-status-badge is-${healthStatus}`}>
            {statusLabel}
          </span>
          {user ? (
            <button className="landing-secondary-btn" onClick={onOpenWorkspace}>
              Mở workspace
            </button>
          ) : (
            <button className="landing-secondary-btn" onClick={onOpenAuth}>
              Đăng nhập
            </button>
          )}
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-hero-kicker">
              Search first • Document second • Ask AI third
            </span>
            <h1>
              Nền tảng tri thức đa nguồn với AI hỗ trợ khai thác, không phải
              ứng dụng chat-centered.
            </h1>
            <p>
              Bắt đầu từ tìm kiếm tài liệu, đọc nguồn và version liên quan, sau
              đó mới dùng AI để tóm tắt, so sánh và hỗ trợ ra quyết định.
            </p>

            <div className="landing-hero-actions">
              <a href="#search-entry" className="landing-primary-btn">
                Tìm kiếm tài liệu
              </a>
              <a href="#how-it-works" className="landing-ghost-btn">
                Khám phá cách hoạt động
              </a>
              <button className="landing-text-btn" onClick={onOpenWorkspace}>
                Hỏi AI từ kho tri thức
              </button>
            </div>

            <div className="landing-proof-grid">
              <div className="landing-proof-card">
                <strong>Knowledge-first</strong>
                <span>Tra cứu tài liệu và nguồn trước khi hỏi AI.</span>
              </div>
              <div className="landing-proof-card">
                <strong>Document-aware</strong>
                <span>Hiển thị nguồn, domain, snippet và thời gian cập nhật.</span>
              </div>
              <div className="landing-proof-card">
                <strong>AI-assisted</strong>
                <span>AI chỉ là lớp hỗ trợ trên dữ liệu đã được quản trị.</span>
              </div>
            </div>
          </div>

          <div className="landing-hero-panel">
            <div className="landing-hero-surface">
              <span className="landing-section-kicker">Product snapshot</span>
              <h2>Người dùng thật sẽ đi theo flow nào?</h2>
              <ol>
                <li>Tìm kiếm theo câu hỏi hoặc từ khóa nghiệp vụ.</li>
                <li>Mở tài liệu, đọc snippet, nguồn và version.</li>
                <li>Dùng AI để tóm tắt hoặc hỏi tiếp trên context đã có.</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="landing-section" id="search-entry">
          <KnowledgeSearchBar
            value={query}
            onChange={setQuery}
            onSubmit={handleSearch}
            isLoading={searching}
          />

          <div className="landing-results-shell">
            <div className="landing-section-head is-compact">
              <span className="landing-section-kicker">Quick search results</span>
              <h2>Xem nhanh kết quả từ backend</h2>
              <p>
                Landing page gọi trực tiếp API search hiện có để mô phỏng cách
                user bắt đầu bằng retrieval, không phải bằng chat.
              </p>
            </div>

            {searchError ? (
              <div className="landing-results-empty is-error">{searchError}</div>
            ) : null}

            {!searchError && !hasSearched ? (
              <div className="landing-results-empty">
                Nhập một truy vấn ở trên để gọi API search và xem quick results.
              </div>
            ) : null}

            {!searchError && hasSearched && !searching && searchResults.length === 0 ? (
              <div className="landing-results-empty">
                Chưa có kết quả phù hợp. Bạn có thể thử một truy vấn khác hoặc
                ingest thêm tài liệu trong backend.
              </div>
            ) : null}

            {searchResults.length > 0 ? (
              <div className="landing-result-grid">
                {searchResults.map((item) => (
                  <article key={item.id} className="landing-result-card">
                    <div className="landing-result-meta">
                      <span>{item.source_name || "Unknown source"}</span>
                      <span>{formatUpdatedAt(item.updated_at)}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.snippet || "Kết quả chưa có snippet."}</p>
                    <div className="landing-result-tags">
                      <span>{item.domain || "general"}</span>
                      <span>{item.source_type || "document"}</span>
                      <span>{item.match_fields?.join(", ") || "search"}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <KnowledgeFeatureCards />
        <KnowledgeFlowSection />
        <KnowledgePreviewSection />
      </main>
    </div>
  );
}
