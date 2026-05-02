import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { listLatestArticles } from "../api/articleApi";
import DiseaseSearchPreview from "../components/landing/DiseaseSearchPreview";
import FeatureCards from "../components/landing/FeatureCards";
import FinalCta from "../components/landing/FinalCta";
import HeroSection from "../components/landing/HeroSection";
import LatestArticles from "../components/landing/LatestArticles";
import StatsSection from "../components/landing/StatsSection";
import SystemTestimonials from "../components/landing/SystemTestimonials";
import WorkflowSection from "../components/landing/WorkflowSection";
import { mockArticles } from "../data/mockArticles";

const MOH_SOURCE_NAME = "Bộ Y tế";

function isMohFeaturedArticle(article) {
  const sourceUrl = String(article?.source_url || "");
  return (
    article?.source_name === MOH_SOURCE_NAME &&
    sourceUrl.includes("moh.gov.vn/index.jsp") &&
    sourceUrl.includes("pageId=5803")
  );
}

export default function HomePage() {
  const outletContext = useOutletContext();
  const openAskPanel = outletContext?.openAskPanel || (() => {});
  const [articleState, setArticleState] = useState({
    loading: true,
    error: "",
    articles: [],
    usingFallback: false,
  });

  useEffect(() => {
    let active = true;

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
          error: error.message || "Không thể tải bài viết mới.",
          articles: mockArticles,
          usingFallback: true,
        });
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="bg-slate-50">
      <HeroSection onAskClick={openAskPanel} />
      <StatsSection />
      <DiseaseSearchPreview />
      <FeatureCards />
      <LatestArticles
        articles={articleState.articles}
        error={articleState.error}
        isLoading={articleState.loading}
        usingFallback={articleState.usingFallback}
      />
      <SystemTestimonials />
      <WorkflowSection />
      <FinalCta />
    </main>
  );
}
