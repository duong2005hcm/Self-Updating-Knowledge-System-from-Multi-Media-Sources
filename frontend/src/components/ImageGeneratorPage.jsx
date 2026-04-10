import React, { useState, useEffect } from "react";
import {
  PictureOutlined,
  ThunderboltOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ArrowsAltOutlined,
  CheckOutlined,
  LoadingOutlined,
  ExpandOutlined,
  CompressOutlined,
  BgColorsOutlined,
} from "@ant-design/icons";
import { Spin, message } from "antd";
import "./ImageGeneratorPage.css";

const IMAGE_WEBHOOK =
  import.meta.env.VITE_N8N_IMAGE_URL ||
  "http://localhost:5678/webhook/generate-image";

const STYLES = [
  { key: "realistic", label: "Realistic", icon: <PictureOutlined /> },
  { key: "anime", label: "Anime", icon: <BgColorsOutlined /> },
  { key: "3d", label: "3D Render", icon: <ExpandOutlined /> },
  { key: "art", label: "Art", icon: <CompressOutlined /> },
];

const SIZES = [
  { key: "1:1", label: "1:1", desc: "Square" },
  { key: "16:9", label: "16:9", desc: "Landscape" },
  { key: "9:16", label: "9:16", desc: "Portrait" },
];

const QUALITIES = [
  { key: "standard", label: "Standard" },
  { key: "hd", label: "HD" },
];

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("realistic");
  const [size, setSize] = useState("1:1");
  const [quality, setQuality] = useState("standard");
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;

    setGenerating(true);
    setImages([]);
    setSelectedImage(null);

    const finalPrompt = `${prompt}, style ${style}, aspect ratio ${size}, quality ${quality}, highly detailed, cinematic lighting`;

    try {
      const requests = [1, 2].map(() =>
        fetch(IMAGE_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: finalPrompt }),
        })
      );

      const responses = await Promise.all(requests);

      const imageUrls = await Promise.all(
        responses.map(async (res) => {
          if (!res.ok) throw new Error(`Request failed: ${res.status}`);
          const blob = await res.blob();
          return URL.createObjectURL(blob);
        })
      );

      setImages(imageUrls);
    } catch (err) {
      console.error(err);
      message.error("Lỗi khi tạo ảnh. Kiểm tra n8n webhook và CORS.");
    } finally {
      setGenerating(false);
    }
  };

  const handleEnhance = () => {
    if (!prompt.trim()) return;
    setPrompt(
      prompt.trim() +
        ", cinematic lighting, highly detailed, 8k resolution, professional photography"
    );
  };

  useEffect(() => {
    return () => {
      images.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [images]);

  return (
    <div className="ig-page">
      <div className="ig-container">
        <div className="ig-header">
          <div className="ig-header-icon">
            <PictureOutlined />
          </div>
          <div>
            <h2 className="ig-header-title">Tạo ảnh AI</h2>
            <p className="ig-header-sub">
              Mô tả hình ảnh bạn muốn — kết nối n8n webhook để tạo ảnh thật.
            </p>
          </div>
        </div>

        <div className="ig-card">
          <div className="ig-prompt-wrap">
            <textarea
              className="ig-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Mô tả hình ảnh bạn muốn tạo..."
              rows={4}
              disabled={generating}
            />
          </div>

          <div className="ig-options">
            <div className="ig-option-group">
              <span className="ig-option-label">Style</span>
              <div className="ig-option-chips">
                {STYLES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`ig-chip ${style === s.key ? "is-active" : ""}`}
                    onClick={() => setStyle(s.key)}
                    disabled={generating}
                  >
                    <span className="ig-chip-icon">{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ig-option-group">
              <span className="ig-option-label">Size</span>
              <div className="ig-option-chips">
                {SIZES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`ig-chip ig-chip--size ${size === s.key ? "is-active" : ""}`}
                    onClick={() => setSize(s.key)}
                    disabled={generating}
                  >
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ig-option-group">
              <span className="ig-option-label">Quality</span>
              <div className="ig-option-chips">
                {QUALITIES.map((q) => (
                  <button
                    key={q.key}
                    type="button"
                    className={`ig-chip ig-chip--quality ${
                      quality === q.key ? "is-active" : ""
                    }`}
                    onClick={() => setQuality(q.key)}
                    disabled={generating}
                  >
                    {quality === q.key && (
                      <CheckOutlined style={{ fontSize: 11 }} />
                    )}
                    <span>{q.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="ig-actions">
            <button
              type="button"
              className="ig-btn ig-btn--enhance"
              onClick={handleEnhance}
              disabled={!prompt.trim() || generating}
            >
              <ThunderboltOutlined />
              <span>Enhance prompt</span>
            </button>

            <button
              type="button"
              className="ig-btn ig-btn--generate"
              onClick={handleGenerate}
              disabled={!prompt.trim() || generating}
            >
              {generating ? (
                <>
                  <LoadingOutlined spin />
                  <span>Đang tạo...</span>
                </>
              ) : (
                <>
                  <PictureOutlined />
                  <span>Tạo ảnh</span>
                </>
              )}
            </button>
          </div>
        </div>

        {(generating || images.length > 0) && (
          <div className="ig-results">
            <h3 className="ig-results-title">
              {generating ? "Đang tạo ảnh..." : "Kết quả"}
            </h3>

            {generating && (
              <div className="ig-grid">
                {[1, 2].map((i) => (
                  <div key={i} className="ig-skeleton">
                    <div className="ig-skeleton-shimmer" />
                    <Spin
                      indicator={
                        <LoadingOutlined
                          spin
                          style={{ fontSize: 24, color: "#6366f1" }}
                        />
                      }
                      className="ig-skeleton-spin"
                    />
                  </div>
                ))}
              </div>
            )}

            {!generating && images.length > 0 && (
              <div className="ig-grid">
                {images.map((src, i) => (
                  <div
                    key={src}
                    className={`ig-image-card ${
                      selectedImage === i ? "is-selected" : ""
                    }`}
                    onClick={() => setSelectedImage(i)}
                  >
                    <img
                      src={src}
                      alt={`Generated ${i + 1}`}
                      className="ig-image"
                      loading="lazy"
                    />
                    <div className="ig-image-overlay">
                      <div className="ig-image-actions">
                        <a
                          href={src}
                          download={`generated-image-${i + 1}.png`}
                          className="ig-img-btn"
                        >
                          <DownloadOutlined />
                        </a>
                        <button type="button" className="ig-img-btn">
                          <ArrowsAltOutlined />
                        </button>
                        <button type="button" className="ig-img-btn">
                          <ReloadOutlined />
                        </button>
                      </div>
                    </div>
                    {selectedImage === i && (
                      <div className="ig-image-check">
                        <CheckOutlined />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
