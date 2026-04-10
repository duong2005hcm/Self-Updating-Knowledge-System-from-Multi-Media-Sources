import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  SearchOutlined,
  ReadOutlined,
  BulbOutlined,
  FormOutlined,
  CheckCircleFilled,
  LoadingOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  LinkOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  DeleteOutlined,
  RightOutlined,
} from "@ant-design/icons";
import "./DeepResearchPage.css";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../auth/firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  onSnapshot,
} from "firebase/firestore";

const DEEP_SEARCH_WEBHOOK =
  import.meta.env.VITE_N8N_DEEP_RESEARCH_URL ||
  "http://localhost:5678/webhook/deep-search";

/* ───────── Guest ID ───────── */
const GUEST_ID_KEY = "deepResearch_guestId";

function getOrCreateGuestId() {
  try {
    let id = sessionStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch {
    return "local";
  }
}

/* ───────── Firestore paths ───────── */
function deepResearchChatsCollection(uid) {
  return uid
    ? collection(db, "users", uid, "deepResearchChats")
    : collection(db, "guestProfiles", getOrCreateGuestId(), "deepResearchChats");
}

function messagesCollection(uid, chatId) {
  return uid
    ? collection(db, "users", uid, "deepResearchChats", chatId, "messages")
    : collection(
        db,
        "guestProfiles",
        getOrCreateGuestId(),
        "deepResearchChats",
        chatId,
        "messages"
      );
}

/* ───────── Steps ───────── */
const RESEARCH_STEPS = [
  { key: "search", label: "Tìm kiếm nguồn", icon: <SearchOutlined /> },
  { key: "read", label: "Đọc tài liệu", icon: <ReadOutlined /> },
  { key: "analyze", label: "Phân tích thông tin", icon: <BulbOutlined /> },
  { key: "write", label: "Viết báo cáo", icon: <FormOutlined /> },
];

export default function DeepResearchPage() {
  const [question, setQuestion] = useState("");
  const [researching, setResearching] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [completed, setCompleted] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [report, setReport] = useState(null);

  const [ownerUid, setOwnerUid] = useState(undefined);
  const ownerUidRef = useRef(ownerUid);

  useEffect(() => {
    ownerUidRef.current = ownerUid;
  }, [ownerUid]);

  /* ───────── Auth & History ───────── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setOwnerUid(user?.uid ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (ownerUid === undefined) return;
    const q = query(deepResearchChatsCollection(ownerUid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [ownerUid]);

  /* ───────── Transform n8n → UI (ĐÃ TỐI ƯU SOURCES) ───────── */
  const transformResponse = (data) => {
    if (!data) return null;

    let answerText = data.answer || data.summary_if_enough || "Không có dữ liệu.";

    // Làm sạch URL khỏi phần answer
    answerText = answerText.replace(/https?:\/\/[^\s,)]+/g, '').trim();

    // Thu thập Sources từ nhiều nguồn
    let sources = [];

    // 1. Từ citations
    if (data.citations && Array.isArray(data.citations)) {
      sources = data.citations.map(c => ({
        title: c.quote ? c.quote.substring(0, 80) + "..." : "Nguồn",
        url: c.url || "#",
      }));
    }

    // 2. Từ recommended_urls
    if (data.recommended_urls && Array.isArray(data.recommended_urls)) {
      data.recommended_urls.forEach(url => {
        if (url && url.startsWith("http") && !sources.some(s => s.url === url)) {
          sources.push({ title: "Nguồn tham khảo", url });
        }
      });
    }

    // 3. Extract URL từ answerText nếu không có nguồn nào
    if (sources.length === 0) {
      const extractedUrls = answerText.match(/https?:\/\/[^\s,)]+/g);
      if (extractedUrls) {
        extractedUrls.forEach(url => {
          sources.push({ title: "Nguồn", url });
        });
      }
    }

    return {
      title: "Kết quả nghiên cứu",
      sections: [{ heading: "Phân tích", content: answerText }],
      sources: sources,
    };
  };

  /* ───────── Webhook ───────── */
  const callWebhook = async () => {
    try {
      const res = await fetch(DEEP_SEARCH_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });

      const rawText = await res.text();
      console.log("🔥 RAW n8n full:", rawText);

      if (!res.ok || !rawText.trim()) {
        throw new Error(`Webhook failed: ${res.status}`);
      }

      const data = JSON.parse(rawText);
      console.log("✅ Parsed data:", data);

      return transformResponse(data);
    } catch (e) {
      console.error("❌ Lỗi callWebhook:", e);
      throw e;
    }
  };

  /* ───────── Save Firestore ───────── */
  const saveChatToFirestore = useCallback(async (q, result) => {
    const uid = ownerUidRef.current;
    const chatRef = await addDoc(deepResearchChatsCollection(uid), {
      question: q,
      result,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const msgs = messagesCollection(uid, chatRef.id);
    await addDoc(msgs, { role: "user", content: q, createdAt: serverTimestamp() });
    await addDoc(msgs, { role: "assistant", result, createdAt: serverTimestamp() });
  }, []);

  /* ───────── Run Research ───────── */
  const handleResearch = async () => {
    if (!question.trim() || researching || ownerUid === undefined) return;

    setResearching(true);
    setCompleted(false);
    setCurrentStep(0);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < RESEARCH_STEPS.length) setCurrentStep(step);
    }, 1200);

    try {
      const result = await callWebhook();

      clearInterval(interval);
      setCurrentStep(RESEARCH_STEPS.length - 1);

      setTimeout(async () => {
        setResearching(false);
        setCompleted(true);
        setReport(result);
        await saveChatToFirestore(question.trim(), result);
      }, 800);
    } catch (e) {
      console.error("❌ Research error:", e);
      clearInterval(interval);
      setResearching(false);

      setReport({
        title: "Lỗi",
        sections: [{ heading: "Không thể lấy dữ liệu", content: e.message }],
        sources: [],
      });
      setCompleted(true);
    }
  };

  /* ───────── Delete & Step Status ───────── */
  const handleDeleteHistory = async (id) => {
    const uid = ownerUidRef.current;
    const msgsCol = messagesCollection(uid, id);
    const snap = await getDocs(msgsCol);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    const parent = uid
      ? doc(db, "users", uid, "deepResearchChats", id)
      : doc(db, "guestProfiles", getOrCreateGuestId(), "deepResearchChats", id);
    batch.delete(parent);
    await batch.commit();
    if (selectedHistoryId === id) setSelectedHistoryId(null);
  };

  const stepStatus = (i) => {
    if (!researching && !completed) return "waiting";
    if (completed) return "done";
    if (i < currentStep) return "done";
    if (i === currentStep) return "active";
    return "waiting";
  };

  return (
    <div className="dr-page">
      {/* SIDEBAR */}
      <div className="dr-sidebar">
        <div className="dr-sidebar-header">
          <ExperimentOutlined className="dr-sidebar-icon" />
          <span className="dr-sidebar-title">Nghiên cứu</span>
        </div>

        <div className="dr-sidebar-list">
          {history.length === 0 ? (
            <div className="dr-sidebar-empty">Chưa có lịch sử</div>
          ) : (
            history.map((h) => (
              <div
                key={h.id}
                className={`dr-sidebar-item ${selectedHistoryId === h.id ? "is-active" : ""}`}
                onClick={() => {
                  setSelectedHistoryId(h.id);
                  setReport(h.result);
                  setCompleted(true);
                }}
              >
                <div className="dr-sidebar-item-content">
                  <span className="dr-sidebar-item-q">{h.question}</span>
                </div>
                <button
                  className="dr-sidebar-item-delete"
                  onClick={(e) => { e.stopPropagation(); handleDeleteHistory(h.id); }}
                >
                  <DeleteOutlined />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAIN */}
      <div className="dr-main">
        <div className="dr-main-inner">
          <div className="dr-header">
            <div className="dr-header-icon">
              <ExperimentOutlined />
            </div>
            <div>
              <h2 className="dr-header-title">Nghiên cứu chuyên sâu</h2>
              <p className="dr-header-sub">
                AI sẽ tìm kiếm, đọc và phân tích nhiều nguồn để tạo báo cáo chi tiết.
              </p>
            </div>
          </div>

          <div className="dr-input-card">
            <textarea
              className="dr-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={researching || ownerUid === undefined}
            />

            <div className="dr-input-footer">
              <span className="dr-input-hint">
                <BulbOutlined /> Câu hỏi càng cụ thể càng tốt
              </span>

              <button className="dr-research-btn" onClick={handleResearch}>
                {researching ? (
                  <>
                    <LoadingOutlined spin /> Đang nghiên cứu...
                  </>
                ) : (
                  <>
                    <ThunderboltOutlined /> Nghiên cứu
                  </>
                )}
              </button>
            </div>
          </div>

          {(researching || completed) && (
            <div className="dr-steps">
              {RESEARCH_STEPS.map((step, i) => {
                const status = stepStatus(i);
                return (
                  <div key={step.key} className={`dr-step dr-step--${status}`}>
                    <div className="dr-step-indicator">
                      {status === "done" ? <CheckCircleFilled /> 
                       : status === "active" ? <LoadingOutlined spin /> 
                       : <ClockCircleOutlined />}
                    </div>
                    <div>{step.label}</div>
                  </div>
                );
              })}
            </div>
          )}

          {completed && report && (
            <div className="dr-report">
              <h2>{report.title}</h2>

              {report.sections?.map((s, i) => (
                <div key={i}>
                  <h3><RightOutlined /> {s.heading}</h3>
                  <p>{s.content}</p>
                </div>
              ))}

              <div>
                <h3><LinkOutlined /> Sources</h3>
                {report.sources && report.sources.length > 0 ? (
                  report.sources.map((src, i) => (
                    <a key={i} href={src.url} target="_blank" rel="noopener noreferrer">
                      <FileTextOutlined /> {src.title}
                    </a>
                  ))
                ) : (
                  <p>Không có nguồn tham khảo.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}