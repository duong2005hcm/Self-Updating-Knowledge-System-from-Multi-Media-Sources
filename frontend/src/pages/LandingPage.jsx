import React, { useCallback, useState } from "react";
import LightRays from "../components/LightRays";
import LandingHeader from "../components/landing/LandingHeader";
import HeroSection from "../components/landing/HeroSection";
import ProblemsSection from "../components/landing/ProblemsSection";
import SolutionsSection from "../components/landing/SolutionsSection";
import FeaturesSection from "../components/landing/FeaturesSection";
import HowItWorksSection from "../components/landing/HowItWorksSection";
import BenefitsSection from "../components/landing/BenefitsSection";
import UseCasesSection from "../components/landing/UseCasesSection";
import TestimonialsSection from "../components/landing/TestimonialsSection";
import FAQSection from "../components/landing/FAQSection";
import FinalCTASection from "../components/landing/FinalCTASection";
import LandingFooter from "../components/landing/LandingFooter";
import ContactModal from "../components/landing/ContactModal";
import ToastMessage from "../components/landing/ToastMessage";

export default function LandingPage() {
  const [contactModal, setContactModal] = useState({
    open: false,
    type: "consultation",
  });
  const [toast, setToast] = useState({ open: false, message: "" });

  const openContactModal = useCallback((type = "consultation") => {
    setContactModal({ open: true, type });
  }, []);

  const closeContactModal = useCallback(() => {
    setContactModal((prev) => ({ ...prev, open: false }));
  }, []);

  const handleContactSuccess = useCallback((type) => {
    setContactModal((prev) => ({ ...prev, open: false }));
    setToast({
      open: true,
      message:
        type === "demo"
          ? "Cảm ơn bạn! Yêu cầu demo đã được gửi thành công."
          : "Cảm ơn bạn! Yêu cầu tư vấn đã được gửi thành công.",
    });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-[#eef4ff] via-[#f7f9ff] to-[#eef2ff] text-slate-900">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_10%_20%,rgba(59,130,246,0.16),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(99,102,241,0.14),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(147,197,253,0.2),transparent_40%)]" />
      <LightRays raysOrigin="top-center" raysColor="#0f172a" followMouse />

      <div className="relative z-10">
        <LandingHeader onOpenContact={openContactModal} />
        <main className="relative">
          <HeroSection onOpenContact={openContactModal} />
          <section className="relative mt-14 border-t border-white/70">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.1),transparent_40%)]" />
            <ProblemsSection />
            <SolutionsSection />
          </section>

          <section className="relative border-y border-slate-200/60 bg-white/35">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.6),rgba(239,246,255,0.4))]" />
            <FeaturesSection />
            <HowItWorksSection />
          </section>

          <section className="relative">
            <BenefitsSection />
            <UseCasesSection />
            <TestimonialsSection />
            <FAQSection />
          </section>

          <FinalCTASection onOpenContact={openContactModal} />
        </main>
        <LandingFooter onOpenContact={openContactModal} />
      </div>

      <ContactModal
        open={contactModal.open}
        type={contactModal.type}
        onClose={closeContactModal}
        onSubmitSuccess={handleContactSuccess}
      />
      <ToastMessage
        open={toast.open}
        message={toast.message}
        onClose={closeToast}
      />
    </div>
  );
}
