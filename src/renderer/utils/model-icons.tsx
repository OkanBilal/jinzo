import { DeepSeek, Gpt, Meta } from "@/components/ui/icons";

export function getModelIcon(modelName: string) {
    const lowerName = modelName.toLowerCase();
    if (lowerName.includes("deepseek")) {
        return <DeepSeek className="w-4 h-4" />;
    }
    if (lowerName.includes("gpt")) {
        return <Gpt className="w-4 h-4" />;
    }
    if (lowerName.includes("llama")) {
        return <Meta className="w-4 h-4" />;
    }
    if (lowerName.includes("gemma")) {
        return <span className="text-sm">💎</span>;
    }
    if (lowerName.includes("mistral")) {
        return <span className="text-sm">🌀</span>;
    }
    if (lowerName.includes("qwen")) {
        return <span className="text-sm">🌐</span>;
    }
    return <span className="text-sm">⚡</span>;
}
