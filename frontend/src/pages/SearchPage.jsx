import { Search, ShieldAlert } from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchMultiSource } from "../api/searchApi";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import LoadingState from "../components/common/LoadingState";
import SectionHeading from "../components/common/SectionHeading";
import CommunityResultCard from "../components/search/CommunityResultCard";
import DocumentResultCard from "../components/search/DocumentResultCard";
import ExternalLinkCard from "../components/search/ExternalLinkCard";
import NewsResultCard from "../components/search/NewsResultCard";
import SearchSection from "../components/search/SearchSection";
import SearchTabs from "../components/search/SearchTabs";
import { useAuth } from "../providers/AuthProvider";

const searchModeOptions = [
  {
    value: "hybrid",
    label: "Hybrid",
    description: "Tìm kết hợp từ khóa và ngữ nghĩa để ưu tiên nguồn thật sự liên quan.",
  },
  {
    value: "semantic",
    label: "Semantic",
    description: "Tìm theo ý nghĩa, phù hợp khi bạn chưa chắc từ khóa chính xác.",
  },
  {
    value: "keyword",
    label: "Keyword",
    description: "Tìm chính xác theo từ khóa xuất hiện trong tiêu đề, tags hoặc nội dung.",
  },
];

const sectionOrder = [
  {
    key: "documents",
    label: "Tài liệu bệnh học",
    emptyMessage: "Chưa có tài liệu bệnh học liên quan.",
  },
  {
    key: "news",
    label: "Tin tức y tế",
    emptyMessage: "Chưa có tin tức y tế liên quan.",
  },
  {
    key: "community",
    label: "Blog cộng đồng",
    emptyMessage: "Chưa có bài viết cộng đồng liên quan.",
  },
  {
    key: "external_links",
    label: "Link tham khảo",
    emptyMessage: "Chưa tìm thấy link ngoài phù hợp.",
  },
];

function getDefaultMinScore(searchMode) {
  return searchMode === "keyword" ? 0 : 0.35;
}

function emptySections() {
  return {
    documents: { label: "Tài liệu bệnh học / PDF", total: 0, items: [] },
    news: { label: "Tin tức y tế liên quan", total: 0, items: [] },
    community: { label: "Bài viết cộng đồng / Blog", total: 0, items: [] },
    external_links: { label: "Link tham khảo bên ngoài", total: 0, items: [] },
  };
}

function renderSectionItem(key, item, showScore) {
  if (key === "documents") {
    return <DocumentResultCard key={item.document_id || item.title} item={item} showScore={showScore} />;
  }
  if (key === "news") {
    return <NewsResultCard key={item.article_id || item.title} item={item} showScore={showScore} />;
  }
  if (key === "community") {
    return <CommunityResultCard key={item.article_id || item.title} item={item} showScore={showScore} />;
  }
  return <ExternalLinkCard key={item.source_url || item.title} item={item} showScore={showScore} />;
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [searchMode, setSearchMode] = useState(searchParams.get("search_mode") || "hybrid");
  const [activeTab, setActiveTab] = useState("all");
  const [state, setState] = useState({
    loading: false,
    error: "",
    total: 0,
    sections: emptySections(),
    message: "",
  });

  const normalizedQuery = useMemo(
    () => String(searchParams.get("q") || "").trim(),
    [searchParams]
  );
  const normalizedMode = searchParams.get("search_mode") || "hybrid";
  const debugEnabled = searchParams.get("debug") === "true" || profile?.isAdmin === true;
  const activeMode =
    searchModeOptions.find((item) => item.value === searchMode) || searchModeOptions[0];

  useEffect(() => {
    setQuery(normalizedQuery);
    setSearchMode(normalizedMode);
    setActiveTab("all");

    if (!normalizedQuery) {
      setState({
        loading: false,
        error: "",
        total: 0,
        sections: emptySections(),
        message: "",
      });
      return;
    }

    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    searchMultiSource(normalizedQuery, {
      searchMode: normalizedMode,
      limit: 10,
      minScore: getDefaultMinScore(normalizedMode),
      includeExternal: true,
      debug: debugEnabled,
    })
      .then((response) => {
        if (!active) return;
        setState({
          loading: false,
          error: "",
          total: response.total || 0,
          sections: { ...emptySections(), ...(response.sections || {}) },
          message: response.message || "",
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          loading: false,
          error: error.message || "Không thể tải kết quả tìm kiếm.",
          total: 0,
          sections: emptySections(),
          message: "",
        });
      });

    return () => {
      active = false;
    };
  }, [debugEnabled, normalizedMode, normalizedQuery]);

  const submit = (event) => {
    event.preventDefault();
    const nextQuery = String(query || "").trim();

    startTransition(() => {
      if (!nextQuery) {
        setSearchParams({});
        return;
      }

      const nextParams = {
        q: nextQuery,
        search_mode: searchMode,
      };
      if (debugEnabled) {
        nextParams.debug = "true";
      }
      setSearchParams(nextParams);
    });
  };

  const tabs = useMemo(() => {
    const counts = state.sections || emptySections();
    return [
      { key: "all", label: "Tất cả", count: state.total || 0 },
      { key: "documents", label: "Tài liệu bệnh học", count: counts.documents?.total || 0 },
      { key: "news", label: "Tin tức y tế", count: counts.news?.total || 0 },
      { key: "community", label: "Blog cộng đồng", count: counts.community?.total || 0 },
      { key: "external_links", label: "Link tham khảo", count: counts.external_links?.total || 0 },
    ];
  }, [state.sections, state.total]);

  return (
    <div className="page-shell py-10 pb-16">
      <div className="glass-panel p-8 sm:p-10">
        <SectionHeading
          kicker="Search Hub"
          title="Tra cứu đa nguồn về bệnh và chủ đề sức khỏe"
          description="Hệ thống tổng hợp tài liệu bệnh học, tin tức y tế, bài viết cộng đồng và liên kết tham khảo ngoài theo cùng một truy vấn."
        />

        <form className="mt-8 grid gap-4 lg:grid-cols-[1fr_240px_180px]" onSubmit={submit}>
          <label className="rounded-[28px] border border-brand-100 bg-brand-50/60 p-2">
            <div className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-3">
              <Search className="h-5 w-5 text-brand-600" />
              <input
                className="w-full border-0 bg-transparent p-0 text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Nhập tên bệnh, triệu chứng hoặc chủ đề sức khỏe..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </label>

          <select
            className="input-base"
            value={searchMode}
            onChange={(event) => setSearchMode(event.target.value)}
          >
            {searchModeOptions.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>

          <button type="submit" className="btn-primary">
            Tìm kiếm
          </button>
        </form>

        <div className="mt-4 rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{activeMode.label}:</span>{" "}
          {activeMode.description}
        </div>

        <div className="mt-6 rounded-[24px] border border-amber-100 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4" />
            Lưu ý tham khảo y tế
          </div>
          Kết quả được cung cấp để hỗ trợ tra cứu thông tin sức khỏe và tài liệu liên quan.
          Vui lòng đối chiếu với nguồn gốc và tham khảo chuyên gia y tế khi cần.
        </div>
      </div>

      <div className="mt-10">
        {state.loading ? (
          <LoadingState
            title="Đang truy xuất nhiều nguồn"
            description="Hệ thống đang tìm trong kho tài liệu, tin tức y tế, blog cộng đồng và các liên kết tham khảo ngoài."
          />
        ) : null}

        {!state.loading && state.error ? (
          <ErrorState
            message={state.error}
            onRetry={() => {
              if (!normalizedQuery) return;
              const params = { q: normalizedQuery, search_mode: normalizedMode };
              if (debugEnabled) params.debug = "true";
              setSearchParams(params);
            }}
          />
        ) : null}

        {!state.loading && !state.error && !normalizedQuery ? (
          <EmptyState
            title="Chưa có truy vấn"
            message="Nhập tên bệnh, triệu chứng hoặc chủ đề sức khỏe để bắt đầu tra cứu đa nguồn."
          />
        ) : null}

        {!state.loading && !state.error && normalizedQuery && state.total === 0 ? (
          <EmptyState
            title="Chưa tìm thấy nguồn phù hợp"
            message={
              state.message ||
              "Hãy thử nhập tên bệnh, triệu chứng khác hoặc dùng từ khóa rộng hơn."
            }
          />
        ) : null}

        {!state.loading && !state.error && state.total > 0 ? (
          <div className="space-y-8">
            <div className="glass-panel p-6">
              <div className="text-sm font-medium text-slate-500">
                Tìm thấy khoảng {state.total} nguồn phù hợp cho truy vấn{" "}
                <span className="font-semibold text-ink">"{normalizedQuery}"</span>.
              </div>
              <div className="mt-5">
                <SearchTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
              </div>
            </div>

            {activeTab === "all" ? (
              <div className="space-y-10">
                {sectionOrder.map((section) => {
                  const sectionData = state.sections[section.key] || emptySections()[section.key];
                  return (
                    <SearchSection
                      key={section.key}
                      title={sectionData.label || section.label}
                      total={sectionData.total}
                      items={sectionData.items}
                      emptyMessage={section.emptyMessage}
                      compact
                      onShowMore={() => setActiveTab(section.key)}
                      renderItem={(item) => renderSectionItem(section.key, item, debugEnabled)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="space-y-10">
                {sectionOrder
                  .filter((section) => section.key === activeTab)
                  .map((section) => {
                    const sectionData = state.sections[section.key] || emptySections()[section.key];
                    return (
                      <SearchSection
                        key={section.key}
                        title={sectionData.label || section.label}
                        total={sectionData.total}
                        items={sectionData.items}
                        emptyMessage={section.emptyMessage}
                        renderItem={(item) => renderSectionItem(section.key, item, debugEnabled)}
                      />
                    );
                  })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
