export default function FeedbackTabs({ value, onChange }) {
  const tabs = [
    { value: "articles", label: "Feedback bài viết" },
    { value: "chatbox", label: "Feedback Chatbox" },
  ];

  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-soft">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            value === tab.value
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
          }`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
