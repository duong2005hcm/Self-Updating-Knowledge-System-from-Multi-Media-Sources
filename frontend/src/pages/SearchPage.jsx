import { Search, ShieldAlert } from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { searchDocuments } from "../api/searchApi";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import LoadingState from "../components/common/LoadingState";
import SectionHeading from "../components/common/SectionHeading";
import { formatDate, formatScore, getStatusTone, truncate } from "../lib/utils";

const searchModes = ["hybrid", "semantic", "keyword"];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [searchMode, setSearchMode] = useState(searchParams.get("search_mode") || "hybrid");
  const [state, setState] = useState({
    loading: false,
    error: "",
    items: [],
    total: 0,
  });

  const normalizedQuery = useMemo(
    () => String(searchParams.get("q") || "").trim(),
    [searchParams]
  );
  const normalizedMode = searchParams.get("search_mode") || "hybrid";
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
      });
      return;
    }

    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));

    searchDocuments(normalizedQuery, {
      searchMode: normalizedMode,
      limit: 10,
    })
      .then((response) => {
        if (!active) return;
        setState({
          loading: false,
          error: "",
          items: response.items || [],
          total: response.matched_total || response.total || 0,
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          loading: false,
          error: error.message || "Không thể tải kết quả tìm kiếm.",
          items: [],
          total: 0,
        });
      });

    return () => {
      active = false;
    };
  }, [normalizedMode, normalizedQuery]);

  const submit = (event) => {
    event.preventDefault();
    const nextQuery = String(query || "").trim();

    startTransition(() => {
      if (!nextQuery) {
        setSearchParams({});
        return;
      }

      setSearchParams({
        q: nextQuery,
        search_mode: searchMode,
      });
    });
  };

  return (
    <div className="page-shell py-10 pb-16">
      <div className="glass-panel p-8 sm:p-10">
        <SectionHeading
          kicker="Search"
          title="Tìm kiếm tài liệu bệnh và chủ đề sức khỏe"
          description="Trang này gọi `GET /api/search` với `search_mode` tương ứng, giới hạn tối đa 10 kết quả cho guest và hiển thị đầy đủ loading, error, empty state."
        />

        <form className="mt-8 grid gap-4 lg:grid-cols-[1fr_220px_180px]" onSubmit={submit}>
          <label className="rounded-[28px] border border-brand-100 bg-brand-50/60 p-2 lg:col-span-1">
            <div className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-3">
              <Search className="h-5 w-5 text-brand-600" />
              <input
                className="w-full border-0 bg-transparent p-0 text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Nhập tên bệnh, triệu chứng hoặc chủ đề sức khỏe…"
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
            {searchModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>

          <button type="submit" className="btn-primary">
            Tìm kiếm
          </button>
        </form>

        <div className="mt-6 rounded-[24px] border border-amber-100 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4" />
            Lưu ý tham khảo y tế
          </div>
          Kết quả được cung cấp để hỗ trợ tra cứu thông tin sức khỏe và tài liệu liên
          quan. Vui lòng đối chiếu với nguồn gốc và tham khảo chuyên gia y tế khi cần.
        </div>
      </div>

      <div className="mt-10">
        {state.loading ? (
          <LoadingState
            title="Đang truy xuất tài liệu"
            description="Search backend đang xử lý câu hỏi và trả về tài liệu phù hợp."
          />
        ) : null}

        {!state.loading && state.error ? (
          <ErrorState
            message={state.error}
            onRetry={() => {
              if (!normalizedQuery) return;
              setSearchParams({
                q: normalizedQuery,
                search_mode: normalizedMode,
              });
            }}
          />
        ) : null}

        {!state.loading && !state.error && !normalizedQuery ? (
          <EmptyState
            title="Chưa có truy vấn"
            message="Nhập từ khóa hoặc câu hỏi sức khỏe để bắt đầu tra cứu trên kho tài liệu."
          />
        ) : null}

        {!state.loading && !state.error && normalizedQuery && state.items.length === 0 ? (
          <EmptyState
            title="Không tìm thấy tài liệu phù hợp"
            message="Hãy thử đổi search mode hoặc rút gọn truy vấn để backend tìm được nhiều tài liệu hơn."
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
                  <span>Score {formatScore(item.score)}</span>
                </div>
                <h3 className="mt-4 font-display text-2xl font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  {truncate(item.snippet, 260)}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <span>source: {item.source_type}</span>
                  <span>match: {(item.match_fields || []).join(", ") || "search"}</span>
                  <span>updated: {formatDate(item.updated_at)}</span>
                </div>
                <div className="mt-5">
                  <Link to={`/documents/${item.id}${detailQueryString}`} className="btn-secondary px-4 py-2.5">
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
