import { useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useParticleLogo } from "../hooks/use-particle-logo";

const CLAUDE_PATHS = [
  "m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z",
];

const CLAUDE_VIEWBOX = "0 0 100 100";

const COPILOT_PATHS = [
  "M4 18v-5.5c0-.667.167-1.333.5-2",
  "M12 7.5c0-1-.01-4.07-4-3.5-3.5.5-4 2.5-4 3.5 0 1.5 0 4 3 4 4 0 5-2.5 5-4zM4 12c-1.333.667-2 1.333-2 2 0 1 0 3 1.5 4 3 2 6.5 3 8.5 3s5.499-1 8.5-3c1.5-1 1.5-3 1.5-4 0-.667-.667-1.333-2-2",
  "M20 18v-5.5c0-.667-.167-1.333-.5-2",
  "M12 7.5v-.297l.01-.269.027-.298.013-.105.033-.215c.014-.073.029-.146.046-.22l.06-.223c.336-1.118 1.262-2.237 3.808-1.873 2.838.405 3.703 1.797 3.93 2.842l.036.204c0 .033.01.066.013.098l.016.185v.661l-.015.394-.02.271c-.122 1.366-.655 2.845-2.962 2.845-3.256 0-4.524-1.656-4.883-3.081l-.053-.242a3.865 3.865 0 0 1-.036-.235l-.021-.227a3.518 3.518 0 0 1-.007-.215zM10 15v2m4-2v2",
];

const COPILOT_VIEWBOX = "0 0 24 24";

interface ParticleLogoCanvasProps {
  className?: string;
  routeType: "claude" | "copilot" | string;
  text?: string;
}

export function ParticleLogoCanvas({ className, routeType, text }: ParticleLogoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const isClaude = routeType === "claude";

  useParticleLogo(canvasRef, {
    svgPaths: isClaude ? CLAUDE_PATHS : COPILOT_PATHS,
    svgViewBox: isClaude ? CLAUDE_VIEWBOX : COPILOT_VIEWBOX,
    color: "#878580",
    text,
    renderMode: isClaude ? "fill" : "stroke",
    strokeWidth: 2,
    enabled: !reducedMotion,
  });

  return <canvas ref={canvasRef} className={className} />;
}
