import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="page-shell py-20">
      <div className="glass-panel mx-auto max-w-2xl px-6 py-12 text-center">
        <div className="section-kicker">404</div>
        <h1 className="mt-4 font-display text-4xl font-bold text-ink">Route không tồn tại</h1>
        <p className="mt-4 text-sm leading-7 text-slate-500">
          Trang bạn đang tìm không nằm trong bộ routing hiện tại của frontend knowledge
          system.
        </p>
        <div className="mt-8">
          <Link to="/" className="btn-primary">
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
