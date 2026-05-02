import { useEffect, useMemo, useState } from "react";
import { getSystemFeedbacks } from "../../api/systemFeedbackApi";
import { formatDateTime, truncate } from "../../lib/utils";
import StarRating from "../blog/StarRating";
import SectionHeading from "../common/SectionHeading";

function getInitial(name = "") {
  return String(name || "U").trim().slice(0, 1).toUpperCase() || "U";
}

function LoadingCards() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-52 animate-pulse rounded-3xl bg-white/80 shadow-soft" />
      ))}
    </div>
  );
}

function TestimonialCard({ feedback, marquee = false }) {
  const name = feedback.user_name || feedback.user_email || "Người dùng";

  return (
    <article
      className={`rounded-3xl border border-white/70 bg-white p-6 shadow-soft ${
        marquee ? "min-h-[260px] w-[280px] shrink-0 sm:w-[360px] lg:w-[390px]" : ""
      }`}
    >
      <StarRating value={Number(feedback.rating || 0)} readonly />
      <p className="mt-4 min-h-[112px] text-sm leading-7 text-slate-600 line-clamp-5">
        “{truncate(feedback.comment || "Người dùng đã đánh giá hệ thống.", 240)}”
      </p>
      <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
          {getInitial(name)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-ink">{name}</div>
          <div className="text-xs text-slate-500">
            {formatDateTime(feedback.updated_at || feedback.created_at)}
          </div>
        </div>
      </div>
    </article>
  );
}

function StaticTestimonialsGrid({ feedbacks }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {feedbacks.map((feedback) => (
        <TestimonialCard key={feedback.feedback_id} feedback={feedback} />
      ))}
    </div>
  );
}

function TestimonialsMarquee({ feedbacks }) {
  const marqueeItems = [...feedbacks, ...feedbacks];

  return (
    <div className="testimonial-marquee-mask overflow-hidden">
      <div className="testimonial-marquee-track flex w-max gap-6">
        {marqueeItems.map((feedback, index) => (
          <TestimonialCard
            key={`${feedback.feedback_id}-${index}`}
            feedback={feedback}
            marquee
          />
        ))}
      </div>
    </div>
  );
}

export default function SystemTestimonials() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let active = true;

    getSystemFeedbacks()
      .then((feedbacks) => {
        if (!active) return;
        setItems(feedbacks);
      })
      .catch(() => {
        if (active) setHidden(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleItems = useMemo(() => {
    return [...items]
      .filter((item) => !item.status || item.status === "active")
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
  }, [items]);

  if (hidden || (!loading && visibleItems.length === 0)) return null;

  const shouldMarquee = visibleItems.length > 3;
  const staticItems = visibleItems.slice(0, 3);

  return (
    <section className="page-shell py-16 lg:py-24">
      <SectionHeading
        kicker="Cảm nhận người dùng"
        title="Người dùng nói gì về hệ thống?"
        description="Những phản hồi thực tế giúp hệ thống được cải thiện liên tục."
      />

      <div className="mt-8">
        {loading ? (
          <LoadingCards />
        ) : shouldMarquee ? (
          <TestimonialsMarquee feedbacks={visibleItems} />
        ) : (
          <StaticTestimonialsGrid feedbacks={staticItems} />
        )}
      </div>
    </section>
  );
}
