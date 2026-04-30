import AboutSection from "../components/landing/AboutSection";
import SystemFeedbackSection from "../components/about/SystemFeedbackSection";
import WorkflowSection from "../components/landing/WorkflowSection";

export default function AboutPage() {
  return (
    <div className="py-10 pb-16">
      <AboutSection />
      <WorkflowSection />
      <SystemFeedbackSection />
    </div>
  );
}
