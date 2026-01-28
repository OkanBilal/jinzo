import { DeepSeek, Gemini, Gpt, Meta } from "@/components/ui/icons";
import { Claude } from "@/components/ui/icons/mood";


export function getModelIcon(modelName: string) {
  const name = modelName.toLowerCase();
  if (name.includes("deepseek")) {
    return <DeepSeek className="w-4 h-4" />;
  }
  if (name.includes("gpt")) {
    return <Gpt className="w-4 h-4" />;
  }
  if (name.includes("llama")) {
    return <Meta className="w-4 h-4" />;
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
  if (name.includes("claude") || name.includes("opus")) {
    return <Claude className="w-4 h-4" />;
  }
  if (name.includes("gemini")) {
    return <Gemini className="w-4 h-4" />;
  }
  // Default icon
  return <span className="text-base">⚡</span>;
}