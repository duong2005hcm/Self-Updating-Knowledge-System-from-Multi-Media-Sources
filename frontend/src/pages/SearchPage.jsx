import { Search, ShieldAlert } from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { searchDocuments } from "../api/searchApi";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import LoadingState from "../components/common/LoadingState";
import SectionHeading from "../components/common/SectionHeading";
import { formatDate, getStatusTone, truncate } from "../lib/utils";
import { useAuth } from "../providers/AuthProvider";

const searchModeOptions = [
  {
    value: "hybrid",
    label: "Hybrid",
    description: "Tìm kết hợp từ khóa và ngữ nghĩa để ưu tiên kết quả thật sự liên quan.",
  },
  {
    value: "semantic",
    label: "Semantic",
    description: "Tìm theo ý nghĩa, phạm vi rộng hơn nhưng vẫn có ngưỡng lọc độ liên quan.",
  },
  {
    value: "keyword",
    label: "Keyword",
    description: "Tìm chính xác theo từ khóa xuất hiện trong tiêu đề, tóm tắt hoặc nội dung tài liệu.",
  },
];

function getRelevanceLabel(item) {
  if (item?.relevance_label === "high") return "Độ phù hợp cao";
  if (item?.relevance_label === "medium") return "Độ phù hợp khá";
  if (item?.relevance_label === "low") return "Độ phù hợp vừa";
  return "Độ phù hợp";
}

function getDefaultMinScore(searchMode) {
  return searchMode === "keyword" ? 0 : 0.35;
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [searchMode, setSearchMode] = useState(searchParams.get("search_mode") || "hybrid");
  const [state, setState] = useState({
    loading: false,
    error: "",
    items: [],
    total: 0,
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

  const detailQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (normalizedQuery) params.set("q", normalizedQuery);
    if (normalizedMode) params.set("search_mode", normalizedMode);
    const value = params.toString();
    return value ? `?${value}` : "";
  }, [normalizedMode, normalizedQuery]);

  useEffect(() => {
    setQuery(normalizedQuery);
    setSearchMode(normalizedMode);

    if (!normalizedQuery) {
      setState({
        loading: false,
        error: "",
        items: [],
        total: 0,
        message: "",
      });
      return;
    }

    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    searchDocuments(normalizedQuery, {
      searchMode: normalizedMode,
      limit: 10,
      minScore: getDefaultMinScore(normalizedMode),
      debug: debugEnabled,
    })
      .then((response) => {
        if (!active) return;
        setState({
          loading: false,
          error: "",
          items: response.items || [],
          total: response.matched_total || response.total || 0,
          message: response.message || "",
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          loading: false,
          error: error.message || "Không thể tải kết quả tìm kiếm.",
          items: [],
          total: 0,
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

  return (
    <div className="page-shell py-10 pb-16">
      <div className="glass-panel p-8 sm:p-10">
        <SectionHeading
          kicker="Search"
          title="Tìm kiếm tài liệu bệnh và chủ đề sức khỏe"
          description="Hệ thống ưu tiên các tài liệu thật sự liên quan và sẽ trả về rỗng khi truy vấn không đạt ngưỡng phù hợp."
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
            title="Đang truy xuất tài liệu"
            description="Hệ thống đang lọc các tài liệu thật sự liên quan đến truy vấn của bạn."
          />
        ) : null}

        {!state.loading && state.error ? (
          <ErrorState
            message={state.error}
            onRetry={() => {
              if (!normalizedQuery) return;
              const params = {
                q: normalizedQuery,
                search_mode: normalizedMode,
              };
              if (debugEnabled) params.debug = "true";
              setSearchParams(params);
            }}
          />
        ) : null}

        {!state.loading && !state.error && !normalizedQuery ? (
          <EmptyState
            title="Chưa có truy vấn"
            message="Nhập tên bệnh, triệu chứng hoặc chủ đề sức khỏe để bắt đầu tra cứu."
          />
        ) : null}

        {!state.loading && !state.error && normalizedQuery && state.items.length === 0 ? (
          <EmptyState
            title="Chưa tìm thấy tài liệu phù hợp"
            message={
              state.message ||
              "Hãy thử nhập tên bệnh, triệu chứng khác hoặc dùng từ khóa rộng hơn."
            }
          />
        ) : null}

        {!state.loading && !state.error && state.items.length > 0 ? (
          <div className="space-y-4">
            <div className="text-sm font-medium text-slate-500">
              Tìm thấy khoảng {state.total} kết quả phù hợp cho truy vấn{" "}
              <span className="font-semibold text-ink">"{normalizedQuery}"</span>.
            </div>

            {state.items.map((item) => (
              <article key={item.id} className="glass-panel p-6">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <span className={`status-pill ${getStatusTone(item.visibility)}`}>
                    {item.visibility}
                  </span>
                  <span>{item.domain}</span>
                  <span>{item.topic}</span>
                  <span>{item.source_name}</span>
                  {debugEnabled ? (
                    <span>Score {Number(item.score || 0).toFixed(3)}</span>
                  ) : (
                    <span>{getRelevanceLabel(item)}</span>
                  )}
                </div>

                <h3 className="mt-4 font-display text-2xl font-semibold text-ink">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-500">
                  {truncate(item.snippet, 260)}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <span>Nguồn: {item.source_type}</span>
                  <span>Cập nhật: {formatDate(item.updated_at)}</span>
                  {debugEnabled && item.reason ? <span>Lý do: {item.reason}</span> : null}
                </div>

                <div className="mt-5">
                  <Link
                    to={`/documents/${item.id}${detailQueryString}`}
                    className="btn-secondary px-4 py-2.5"
                  >
                    Xem chi tiết
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
