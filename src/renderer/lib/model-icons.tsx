import { Cursor, DeepSeek, Gemini, Gpt, Grok, Kimi, Meta } from "@/components/ui/icons";
import { Claude } from "@/components/ui/icons/space";


export function getModelIcon(modelName: string) {
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
  if (name.includes("opus")) {
    return <Claude className="size-3.5" />;
  }
  if (name.includes("sonnet")) {
    return <Claude className="size-3.5" />;
  }
  if (name.includes("haiku")) {
    return <Claude className="size-3.5" />;
  }
  if (name.includes("claude")) {
    return <Claude className="size-3.5" />;
  }
  if (name.includes("gemini")) {
    return <Gemini className="size-3.5" />;
  }
    if (name.includes("composer")) {
    return <Cursor className="size-3.5" />;
  }
      if (name.includes("auto")) {
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
