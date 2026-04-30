import type {
  ServiceResponse,
  ListArgs,
  SearchArgs,
  SkillRef,
  SkillListResponse,
  SkillSearchResponse,
  CuratedResponse,
  SkillDetailResponse,
  SkillAuditResponse,
} from "./skillsMarketplace.dto";

const BASE_URL = "https://skills.sh/api/v1";

async function request<T>(path: string): Promise<ServiceResponse<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        success: false,
        error: `skills.sh ${res.status}: ${text || res.statusText}`,
      };
    }
    const data = (await res.json()) as T;
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (entries.length === 0) return "";
  const qs = new URLSearchParams();
  for (const [k, v] of entries) qs.set(k, String(v));
  return `?${qs.toString()}`;
}

export const skillsMarketplaceService = {
  async list(args: ListArgs = {}): Promise<ServiceResponse<SkillListResponse>> {
    const qs = buildQuery({
      view: args.view,
      page: args.page,
      per_page: args.perPage,
    });
    return request<SkillListResponse>(`/skills${qs}`);
  },

  async search(args: SearchArgs): Promise<ServiceResponse<SkillSearchResponse>> {
    const q = (args.q ?? "").trim();
    if (q.length < 2) {
      return { success: false, error: "Query must be at least 2 characters" };
    }
    const qs = buildQuery({ q, limit: args.limit });
    return request<SkillSearchResponse>(`/skills/search${qs}`);
  },

  async curated(): Promise<ServiceResponse<CuratedResponse>> {
    return request<CuratedResponse>(`/skills/curated`);
  },

  async detail(ref: SkillRef): Promise<ServiceResponse<SkillDetailResponse>> {
    const source = encodeURIComponent(ref.source);
    const skill = encodeURIComponent(ref.skill);
    return request<SkillDetailResponse>(`/skills/${source}/${skill}`);
  },

  async audit(ref: SkillRef): Promise<ServiceResponse<SkillAuditResponse>> {
    const source = encodeURIComponent(ref.source);
    const skill = encodeURIComponent(ref.skill);
    return request<SkillAuditResponse>(`/skills/audit/${source}/${skill}`);
  },
};
