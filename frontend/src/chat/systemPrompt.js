const STORAGE_KEY = "ragai_system_prompt";

/** Prompt mặc định khi người dùng chưa tùy chỉnh */
export const DEFAULT_SYSTEM_PROMPT = `Bạn là trợ lý AI của SIMLESI. Trả lời bằng tiếng Việt, rõ ràng và lịch sự.
Ưu tiên dựa trên ngữ cảnh tài liệu được truy xuất (RAG). Nếu không đủ thông tin, hãy nói rõ và đề xuất cách bổ sung.`;

export function getSystemPrompt() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v != null && String(v).trim() !== "") return String(v);
  } catch {
    /* ignore */
  }
  return DEFAULT_SYSTEM_PROMPT;
}

export function setSystemPrompt(text) {
  try {
    localStorage.setItem(STORAGE_KEY, String(text ?? ""));
  } catch {
    /* ignore */
  }
}

export function resetSystemPrompt() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Gợi ý nhanh — chỉ điền vào ô nhập, người dùng vẫn có thể sửa */
export const PROMPT_PRESETS = [
  {
    id: "default",
    label: "Mặc định SIMLESI",
    text: DEFAULT_SYSTEM_PROMPT,
  },
  {
    id: "short",
    label: "Trả lời ngắn gọn",
    text: `${DEFAULT_SYSTEM_PROMPT}\n\nTrả lời súc tích, ưu tiên gạch đầu dòng khi liệt kê.`,
  },
  {
    id: "teacher",
    label: "Giải thích như giáo viên",
    text: `${DEFAULT_SYSTEM_PROMPT}\n\nGiải thích từng bước, dùng ví dụ đơn giản khi cần.`,
  },
  {
    id: "strict-rag",
    label: "Chỉ dùng tài liệu",
    text: `Chỉ trả lời dựa trên đoạn ngữ cảnh được cung cấp. Nếu không có trong tài liệu, hãy nói "Không có trong tài liệu" và không suy đoán.`,
  },
];
