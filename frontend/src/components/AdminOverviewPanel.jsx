import React, { useCallback, useEffect, useState } from "react";
import {
  adminGetStats,
  adminGetUsers,
  adminGetLoginAnalytics,
  adminGetTokenDaily,
} from "../api/ragapi";

function LoginBarChart({ buckets }) {
  const w = 520;
  const h = 240;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 48;
  const n = Math.max(buckets?.length || 0, 1);
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const max = Math.max(...(buckets || []).map((b) => b.count || 0), 1);
  const gap = 4;
  const barW = Math.max(4, (chartW - gap * (n - 1)) / n);

  return (
    <svg className="admin-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      <line x1={padL} y1={padT + chartH} x2={w - padR} y2={padT + chartH} stroke="#e2e8f0" strokeWidth="2" />
      {(buckets || []).map((b, i) => {
        const bh = (b.count / max) * chartH;
        const x = padL + i * (barW + gap);
        const y = padT + chartH - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx="6" fill="url(#gLogin)" />
            <text
              x={x + barW / 2}
              y={h - 28}
              textAnchor="middle"
              fontSize="10"
              fill="#64748b"
              fontWeight="700"
            >
              {b.label.length > 6 ? `${b.label.slice(0, 5)}…` : b.label}
            </text>
            {b.count > 0 ? (
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="11"
                fill="#0f172a"
                fontWeight="800"
              >
                {b.count}
              </text>
            ) : null}
          </g>
        );
      })}
      <defs>
        <linearGradient id="gLogin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function AdminOverviewPanel({ adminUser }) {
  const [stats, setStats] = useState({ userCount: 0, totalTokens: 0 });
  const [period, setPeriod] = useState("day");
  const [loginData, setLoginData] = useState(null);
  const [tokenRows, setTokenRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const loadStats = useCallback(async () => {
    let listLen = 0;
    try {
      const usersRes = await adminGetUsers();
      listLen = usersRes?.users?.length ?? 0;
    } catch {
      /* quyền hoặc mạng — vẫn thử stats */
    }
    let statCount = 0;
    let totalTokens = 0;
    try {
      const res = await adminGetStats();
      if (res?.ok) {
        statCount = res.userCount ?? 0;
        totalTokens = res.totalTokens ?? 0;
      }
    } catch {
      /* ignore */
    }
    // Trùng logic trang Người dùng (đếm dòng API); lấy max nếu stats Firestore lớn hơn (trường hợp lệch)
    setStats({
      userCount: Math.max(listLen, statCount),
      totalTokens,
    });
  }, []);

  const loadLogin = useCallback(async () => {
    const res = await adminGetLoginAnalytics(period);
    if (res?.ok) setLoginData(res);
    else setLoginData(null);
  }, [period]);

  const loadTokens = useCallback(async () => {
    const res = await adminGetTokenDaily(14);
    if (res?.rows) setTokenRows(res.rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        await loadStats();
        if (!cancelled) await loadLogin();
        if (!cancelled) await loadTokens();
      } catch (e) {
        if (!cancelled) setErr(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadLogin();
      } catch (e) {
        if (!cancelled) setErr(e.message || String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLogin]);

  const name = adminUser?.name || adminUser?.email || "Admin";

  const authSnap = loginData?.authSnapshot;
  const authDelta =
    authSnap && !authSnap.error
      ? (authSnap.lastSignInInCurrentPeriod || 0) - (authSnap.lastSignInInPreviousPeriod || 0)
      : null;

  if (loading && !loginData) {
    return <div className="admin-loading">Đang tải tổng quan…</div>;
  }

  return (
    <div className="admin-overview-page">
      <div className="admin-overview-hello">
        Chào <strong>{name}</strong> — bạn đang xem bảng điều khiển quản trị.
      </div>

      {err ? (
        <p className="admin-overview-err">{err}</p>
      ) : null}

      <div className="admin-overview-grid-2">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Tổng người dùng</div>
          <div className="admin-stat-value">{stats.userCount}</div>
          <p className="admin-stat-hint">
            
          </p>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Tổng token RAG (ước lượng)</div>
          <div className="admin-stat-value">{stats.totalTokens.toLocaleString("vi-VN")}</div>
          <p className="admin-stat-hint">Cộng dồn từ phản hồi API hoặc ước lượng theo độ dài tin nhắn.</p>
        </div>
      </div>

      <div className="admin-overview-split">
        <div className="admin-chart-card admin-chart-wide">
          <div className="admin-chart-title">Lượt đăng nhập vào hệ thống</div>
          <p className="admin-chart-sub">
            Biểu đồ: số lần xác thực qua API (Firestore <code>login_events</code>), múi giờ Việt Nam. Trục ngang
            theo kỳ đã chọn (giờ / thứ / ngày / tháng). Số liệu Firebase Auth (đăng nhập cuối) nằm ở cột phải và
            bảng phía dưới.
          </p>
          {loginData?.buckets ? <LoginBarChart buckets={loginData.buckets} /> : (
            <p className="admin-empty">Chưa có dữ liệu đăng nhập (đăng nhập sau khi cập nhật server).</p>
          )}
        </div>
        <div className="admin-chart-card admin-chart-sidecard">
          <div className="admin-chart-title">Kỳ thống kê</div>
          <div className="admin-period-btns">
            {[
              { v: "day", l: "Ngày (giờ)" },
              { v: "week", l: "Tuần (thứ)" },
              { v: "month", l: "Tháng (ngày)" },
              { v: "year", l: "Năm (tháng)" },
            ].map((x) => (
              <button
                key={x.v}
                type="button"
                className={`admin-period-btn ${period === x.v ? "is-on" : ""}`}
                onClick={() => setPeriod(x.v)}
              >
                {x.l}
              </button>
            ))}
          </div>
          <div className="admin-side-stats">
            <div>
              <span className="admin-side-label">Trung bình / cột</span>
              <strong>{loginData?.averagePerBucket ?? "—"}</strong>
            </div>
            <div>
              <span className="admin-side-label">Trung bình / cột có dữ liệu</span>
              <strong>{loginData?.averageActiveBuckets ?? "—"}</strong>
            </div>
            <div>
              <span className="admin-side-label">Tổng kỳ này</span>
              <strong>{loginData?.total ?? 0}</strong>
            </div>
          </div>
          {loginData?.authSnapshot && !loginData.authSnapshot.error ? (
            <>
              <p className="admin-chart-sub" style={{ marginTop: 14, marginBottom: 8 }}>
                Firebase Authentication — <code>lastSignInTime</code>
              </p>
              <div className="admin-side-stats">
                <div>
                  <span className="admin-side-label">Tài khoản Auth (tổng)</span>
                  <strong>{loginData.authSnapshot.totalAuthUsers ?? "—"}</strong>
                </div>
                <div>
                  <span className="admin-side-label">Có ĐNC trong kỳ này</span>
                  <strong>{loginData.authSnapshot.lastSignInInCurrentPeriod ?? "—"}</strong>
                </div>
                <div>
                  <span className="admin-side-label">Có ĐNC trong kỳ trước</span>
                  <strong>{loginData.authSnapshot.lastSignInInPreviousPeriod ?? "—"}</strong>
                </div>
              </div>
            </>
          ) : loginData?.authSnapshot?.error ? (
            <p className="admin-overview-err" style={{ marginTop: 12, fontSize: 12 }}>
              Không đọc Firebase Auth: {String(loginData.authSnapshot.error)}
            </p>
          ) : null}
          <p className="admin-chart-sub" style={{ marginTop: 12 }}>
            Kỳ so sánh: cùng độ dài kỳ liền trước (VD: hôm qua so với hôm nay…).
          </p>
        </div>
      </div>

      <div className="admin-table-card" style={{ marginTop: 18 }}>
        <div className="admin-table-title">Tăng / giảm lượt đăng nhập</div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Chỉ số</th>
              <th>Giá trị</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={2} className="admin-table-section">
                Lượt xác thực (Firestore)
              </td>
            </tr>
            <tr>
              <td>Kỳ hiện tại</td>
              <td>{loginData?.total ?? "—"}</td>
            </tr>
            <tr>
              <td>Kỳ trước</td>
              <td>{loginData?.previousTotal ?? "—"}</td>
            </tr>
            <tr>
              <td>Chênh lệch</td>
              <td style={{ color: (loginData?.delta || 0) >= 0 ? "#15803d" : "#b91c1c" }}>
                {(loginData?.delta ?? 0) >= 0 ? "+" : ""}
                {loginData?.delta ?? "—"}
                {loginData?.deltaPercent != null ? ` (${loginData.deltaPercent}%)` : ""}
              </td>
            </tr>
            {loginData?.authSnapshot && !loginData.authSnapshot.error ? (
              <>
                <tr>
                  <td colSpan={2} className="admin-table-section">
                    Tài khoản có đăng nhập cuối trong kỳ (Firebase Auth)
                  </td>
                </tr>
                <tr>
                  <td>Kỳ hiện tại</td>
                  <td>{loginData.authSnapshot.lastSignInInCurrentPeriod ?? "—"}</td>
                </tr>
                <tr>
                  <td>Kỳ trước</td>
                  <td>{loginData.authSnapshot.lastSignInInPreviousPeriod ?? "—"}</td>
                </tr>
                <tr>
                  <td>Chênh lệch</td>
                  <td
                    style={{
                      color: authDelta != null && authDelta >= 0 ? "#15803d" : "#b91c1c",
                    }}
                  >
                    {authDelta != null ? (
                      <>
                        {authDelta >= 0 ? "+" : ""}
                        {authDelta}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              </>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="admin-table-card" style={{ marginTop: 18 }}>
        <div className="admin-table-title">Token theo ngày (14 ngày gần nhất)</div>
        <div className="admin-table-wrap-inner">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ngày (VN)</th>
                <th>Token</th>
                <th>So với hôm trước</th>
              </tr>
            </thead>
            <tbody>
              {tokenRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="admin-empty-cell">
                    Chưa có sự kiện token.
                  </td>
                </tr>
              ) : (
                tokenRows.map((r) => (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    <td>{Number(r.tokens).toLocaleString("vi-VN")}</td>
                    <td>
                      {r.delta == null
                        ? "—"
                        : `${r.delta >= 0 ? "+" : ""}${Number(r.delta).toLocaleString("vi-VN")}`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        className="admin-btn-reload"
        onClick={async () => {
          setLoading(true);
          try {
            await loadStats();
            await loadLogin();
            await loadTokens();
          } catch (e) {
            setErr(e.message || String(e));
          } finally {
            setLoading(false);
          }
        }}
      >
        Làm mới dữ liệu
      </button>
    </div>
  );
}
