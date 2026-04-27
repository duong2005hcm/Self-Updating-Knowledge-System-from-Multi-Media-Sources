import { useEffect, useState } from "react";
import { listLatestArticles } from "../api/articleApi";
import { getBackendHealth } from "../api/publicApi";
import AboutSection from "../components/landing/AboutSection";
import DiseaseSearchPreview from "../components/landing/DiseaseSearchPreview";
import FaqSection from "../components/landing/FaqSection";
import FeatureCards from "../components/landing/FeatureCards";
import FinalCta from "../components/landing/FinalCta";
import HeroSection from "../components/landing/HeroSection";
import LatestArticles from "../components/landing/LatestArticles";
import StatsSection from "../components/landing/StatsSection";
import WorkflowSection from "../components/landing/WorkflowSection";
import { mockArticles } from "../data/mockArticles";

const initialHealth = {
  status: "degraded",
  label: "Đang kiểm tra backend",
};

function mapHealthState(payload) {
  if (payload?.status === "ok") {
    return {
      status: "healthy",
      label: "Backend đang sẵn sàng",
    };
  }

  return {
    status: "offline",
    label: "Backend hiện chưa phản hồi",
  };
}

export default function HomePage() {
  const [healthState, setHealthState] = useState(initialHealth);
  const [articles, setArticles] = useState(mockArticles);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    let active = true;

    getBackendHealth()
      .then((payload) => {
        if (!active) return;
        setHealthState(mapHealthState(payload));
      })
      .catch(() => {
        if (!active) return;
        setHealthState({
          status: "offline",
          label: "Backend hiện chưa phản hồi",
        });
      });

    listLatestArticles(6)
      .then((response) => {
        if (!active) return;
        if (response?.items?.length) {
          setArticles(response.items);
          setUsingFallback(false);
        }
      })
      .catch(() => {
        if (!active) return;
        setArticles(mockArticles);
        setUsingFallback(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <HeroSection healthState={healthState} />
      <StatsSection />
      <FeatureCards />
      <WorkflowSection />
      <LatestArticles articles={articles} usingFallback={usingFallback} />
      <DiseaseSearchPreview />
      <FaqSection />
      <AboutSection />
      <FinalCta />
    </>
  );
}
