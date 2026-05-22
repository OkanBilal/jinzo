import {
  CopilotStatic,
  Cursor,
  DeepSeek,
  Gemini,
  Gpt,
  Grok,
  Kimi,
  Mains,
  Meta,
} from "@/components/ui/icons";
import { Claude } from "@/components/ui/icons/space";

export type ModelIconVariant = "claude" | "copilot" | "codex" | "cursor";

function formatCursorModelName(model: string): string {
  if (model === "default") return "Default";
  if (model === "composer-2" ) return "Composer 2 (Fast)";
  if (model === "composer-2.5") return "Composer 2.5 (Fast)";

  const BRANDS: Record<string, string> = {
    gpt: "GPT",
    claude: "Claude",
    gemini: "Gemini",
    composer: "Composer",
    grok: "Grok",
    kimi: "Kimi",
    codex: "Codex",
  };

  const parts = model.split("-");
  const brand = parts[0];
  const brandDisplay = BRANDS[brand] ?? (brand.charAt(0).toUpperCase() + brand.slice(1));
  const rest = parts.slice(1);
  const tokens: string[] = [];

  let i = 0;
  while (i < rest.length) {
    const curr = rest[i];
    const next = rest[i + 1];
    if (/^\d+$/.test(curr) && next !== undefined && /^\d+$/.test(next)) {
      tokens.push(`${curr}.${next}`);
      i += 2;
    } else {
      tokens.push(/^[\d.]/.test(curr) ? curr : curr.charAt(0).toUpperCase() + curr.slice(1));
      i++;
    }
  }

  if (tokens.length === 0) return brandDisplay;
  if (brand === "gpt" && /^[\d.]/.test(tokens[0])) {
    return `${brandDisplay}-${tokens.join("-")}`;
  }
  return `${brandDisplay} ${tokens.join(" ")}`;
}

export function formatModelDisplayName(model: string, variant?: ModelIconVariant): string {
  if (variant === "cursor") return formatCursorModelName(model);
  return model;
}

export function getModelPrettyName(
  model: { displayName: string; description?: string },
  variant?: ModelIconVariant,
): string {
  if (variant === "cursor") return formatCursorModelName(model.displayName);
  if (variant === "claude" && model.description) {
    const firstPart = model.description.split("·")[0].trim();
    return firstPart.replace(/ with 1M context$/, " [1M]");
  }
  return model.displayName;
}

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
  return <Mains className="size-3.5" />;
}
