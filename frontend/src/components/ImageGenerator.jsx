import React, { useState } from "react";

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError("Vui lòng nhập mô tả ảnh!");
      return;
    }

    setLoading(true);
    setError("");
    if (imageUrl) URL.revokeObjectURL(imageUrl);

    try {
      const res = await fetch("http://localhost:5678/webhook/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) throw new Error(`Lỗi server: ${res.status}`);

      const blob = await res.blob();
      if (blob.size < 1000) throw new Error("Không nhận được ảnh hợp lệ");

      const newImageUrl = URL.createObjectURL(blob);
      setImageUrl(newImageUrl);
      setError("");

    } catch (err) {
      console.error(err);
      setError(err.message || "Tạo ảnh thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  // Các gợi ý prompt mẫu
  const suggestions = [
    "Một con chó golden retriever dễ thương đang chạy trên bãi biển lúc hoàng hôn",
    "Cô gái anime tóc hồng đứng dưới mưa neon ở Tokyo đêm",
    "Phong cảnh núi non hùng vĩ vào lúc bình minh, sương mù bao phủ",
    "Siêu xe Lamborghini màu đỏ đang chạy tốc độ cao trên đường cao tốc",
  ];

  return (
    <div className="chat-container">
      {/* Header giống chat bình thường */}
      <div className="chat-welcome">
        <h1>🎨 Tạo ảnh AI</h1>
        <p>Nhập mô tả chi tiết, SIMLESI AI sẽ tạo ảnh đẹp cho bạn</p>
      </div>

      {/* Gợi ý prompt mẫu */}
      <div className="suggestions">
        <p>Vài ý tưởng bạn có thể thử:</p>
        <div className="suggestion-buttons">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              className="suggestion-btn"
              onClick={() => setPrompt(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Khu vực hiển thị ảnh */}
      <div className="image-result">
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Đang tạo ảnh... Vui lòng chờ một chút</p>
          </div>
        )}

        {imageUrl && (
          <div className="generated-image">
            <img src={imageUrl} alt="AI Generated" />
            <div className="image-actions">
              <a href={imageUrl} download="ai-image.png" className="download-btn">
                ⬇️ Tải ảnh về
              </a>
              <button onClick={() => setImageUrl(null)} className="reset-btn">
                Tạo ảnh mới
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Input giống ChatInput */}
      <div className="chat-input-inner">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              generateImage();
            }
          }}
          placeholder="Nhập mô tả ảnh bạn muốn tạo..."
          rows={3}
          disabled={loading}
        />

        <button
          onClick={generateImage}
          disabled={loading || !prompt.trim()}
          className="send-btn"
        >
          {loading ? "⏳" : "Tạo Ảnh"}
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}
    </div>
  );
}