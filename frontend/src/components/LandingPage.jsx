import React from "react";
import { Link } from "react-router-dom";
import LightRays from "./LightRays";
import LandingIllustration from "./LandingIllustration";

const BRAND = "SIMLESI AI";
const TOPIC = "Hệ thống tri thức tự cập nhật từ đa nguồn đa phương tiện";

export default function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-blobs" aria-hidden />
      <LightRays raysOrigin="top-center" raysColor="#0c1a3a" followMouse />

      <div className="landing-shell">
        <div className="landing-card">
          <header className="landing-header">
            <div className="landing-brand">
              <div className="landing-brand-mark" aria-hidden />
              <div>
                <div className="landing-brand-name">{BRAND}</div>
                <div className="landing-brand-tag">Self-Updating Knowledge</div>
              </div>
            </div>
            <nav className="landing-nav" aria-label="Tài khoản">
              <Link to="/login" className="landing-btn landing-btn-ghost">
                Đăng nhập
              </Link>
              <Link to="/register" className="landing-btn landing-btn-primary">
                Đăng ký
              </Link>
            </nav>
          </header>

          <div className="landing-body">
            <div className="landing-copy">
              <p className="landing-kicker">Đề tài · RAG &amp; tri thức động</p>
              <h1 className="landing-title">{TOPIC}</h1>
              <p className="landing-lead">
                Tích hợp tài liệu, web và nội dung đa phương tiện thành một kho kiến thức luôn được cập nhật.
                Hỏi đáp thông minh với trích dẫn nguồn rõ ràng — giao diện chat hiện đại, dễ sử dụng.
              </p>
              <div className="landing-cta-row">
                <Link
                  to="/register"
                  className="landing-btn landing-btn-cta landing-btn-lg"
                >
                  Tìm hiểu thêm
                </Link>
                <Link
                  to="/login"
                  className="landing-btn landing-btn-outline landing-btn-lg"
                >
                  Đã có tài khoản
                </Link>
              </div>
              <ul className="landing-features" aria-label="Điểm nổi bật">
                <li className="landing-feature-pill">RAG &amp; trích dẫn nguồn</li>
                <li className="landing-feature-pill">Đa phương tiện</li>
                <li className="landing-feature-pill">Quản trị kiến thức</li>
              </ul>
            </div>
            <div className="landing-visual">
              <LandingIllustration />
            </div>
          </div>
        </div>

        <footer className="landing-footer">
          <p>Bản quyền © 2026 RAG AI System · SIMLESI AI</p>
        </footer>
      </div>
    </div>
  );
}
