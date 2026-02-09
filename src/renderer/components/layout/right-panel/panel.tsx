import { PANEL_COMPONENTS, DEFAULT_PANEL_COMPONENT } from "./panel-components";

interface PanelProps {
  isVisible: boolean;
  isAnimatedIn: boolean;
  width: string;
  component: string;
}

export function Panel({ isVisible, isAnimatedIn, width, component }: PanelProps) {
  const PanelContent = PANEL_COMPONENTS[component] || DEFAULT_PANEL_COMPONENT;

  if (!isVisible) return null;

  return (
    <div
      className="block fixed top-0 bottom-0 right-0 overflow-hidden transition-all duration-300 ease-out bg-transparent z-50"
      style={{
        width: width,
        transform: isAnimatedIn ? "translateX(0)" : "translateX(100%)",
        opacity: isAnimatedIn ? 1 : 0,
      }}
      role="complementary"
      aria-label="Right panel"
    >
      <PanelContent />
    </div>
  );
}
