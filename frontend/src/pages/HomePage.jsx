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

const MOH_SOURCE_NAME = "Bộ Y tế";

function isMohFeaturedArticle(article) {
  const sourceUrl = String(article?.source_url || "");
  return (
    article?.source_name === MOH_SOURCE_NAME &&
    sourceUrl.includes("moh.gov.vn/index.jsp") &&
    sourceUrl.includes("pageId=5803")
  );
}

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
  const [articleState, setArticleState] = useState({
    loading: true,
    error: "",
    articles: [],
    usingFallback: false,
  });

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

    setArticleState((current) => ({
      ...current,
      loading: true,
      error: "",
      usingFallback: false,
    }));

    listLatestArticles(6, { sourceName: MOH_SOURCE_NAME })
      .then((response) => {
        if (!active) return;
        setArticleState({
          loading: false,
          error: "",
          articles: (response?.items || []).filter(isMohFeaturedArticle),
          usingFallback: false,
        });
      })
      .catch((error) => {
        if (!active) return;
        setArticleState({
          loading: false,
          error: error.message || "Không thể tải bài viết từ backend.",
          articles: mockArticles,
          usingFallback: true,
        });
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
      <LatestArticles
        articles={articleState.articles}
        error={articleState.error}
        isLoading={articleState.loading}
        usingFallback={articleState.usingFallback}
      />
      <DiseaseSearchPreview />
      <FaqSection />
      <AboutSection />
      <FinalCta />
    </>
  );
}
