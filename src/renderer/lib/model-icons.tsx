import {
  CopilotStatic,
  Cursor,
  DeepSeek,
  Gemini,
  Gpt,
  Grok,
  Kimi,
  Meta,
} from "@/components/ui/icons";
import { Claude } from "@/components/ui/icons/space";

export type ModelIconVariant = "claude" | "copilot" | "codex" | "cursor";

export function getModelIcon(modelName: string, variant?: ModelIconVariant) {
  const name = modelName.toLowerCase();
  if (name.includes("deepseek")) {
    return <DeepSeek className="size-3.5" />;
  }
  if (name.includes("gpt")) {
    return <Gpt className="size-3.5" />;
  }
  if (name.includes("llama")) {
    return <Meta className="size-3.5" />;
  }
  if (name.includes("gemma")) {
    return <span className="text-base">💎</span>;
  }
  if (name.includes("mistral")) {
    return <span className="text-base">🌀</span>;
  }
  if (name.includes("qwen")) {
    return <span className="text-base">🌐</span>;
  }
  if (
    name.includes("opus") ||
    name.includes("sonnet") ||
    name.includes("haiku") ||
    name.includes("claude") ||
    name === "default" ||
    name.startsWith("default ")
  ) {
    return <Claude className="size-3.5" />;
  }
  if (name.includes("gemini")) {
    return <Gemini className="size-3.5" />;
  }
  if (name.includes("composer")) {
    return <Cursor className="size-3.5" />;
  }
  if (name.includes("auto")) {
    if (variant === "copilot") {
      return <CopilotStatic className="size-3.5" />;
    }
    return <Cursor className="size-3.5" />;
  }
  if (name.includes("codex")) {
    return <Gpt className="size-3.5" />;
  }
  if (name.includes("grok")) {
    return <Grok className="size-3.5" />;
  }
  if (name.includes("kimi")) {
    return <Kimi className="size-3.5" />;
  }
  // Default icon
  return <span className="text-base">⚡</span>;
}
