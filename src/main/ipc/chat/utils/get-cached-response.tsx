import { ChatResponse } from "../types";
import { responseCache } from "./rag";

function generateCacheKey(question: string, model: string) {
  return { question, model };
}

function getCachedResponse(
  question: string,
  model: string,
  sessionId: number | null,
  noCache?: boolean,
): ChatResponse | null {
  if (noCache) {
    return null;
  }

  const cacheKey = generateCacheKey(question, model);
  const cachedAnswer = responseCache.get(cacheKey);

  if (!cachedAnswer) {
    return null;
  }

  console.log("✓ Response cache hit");

  return {
    answer: cachedAnswer as string,
    sessionId,
    sources: [],
    metadata: {
      queryType: "cached",
      totalRetrieved: 0,
      usedInContext: 0,
      cached: true,
    },
  };
}
export { getCachedResponse };
