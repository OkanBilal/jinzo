const labelColors: Record<string, string> = {
  bug: "bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-300",
  fix: "bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-300",
  feature:
    "bg-purple-500/20 text-purple-700 dark:bg-purple-500/30 dark:text-purple-300",
  enhancement:
    "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300",
  improvement:
    "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300",
  documentation:
    "bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-300",
  docs: "bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-300",
  refactor:
    "bg-cyan-500/20 text-cyan-700 dark:bg-cyan-500/30 dark:text-cyan-300",
  test: "bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-300",
  testing:
    "bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-300",

  critical: "bg-red-600/20 text-red-800 dark:bg-red-600/30 dark:text-red-200",
  urgent:
    "bg-orange-500/20 text-orange-700 dark:bg-orange-500/30 dark:text-orange-300",
  high: "bg-orange-500/20 text-orange-700 dark:bg-orange-500/30 dark:text-orange-300",
  medium:
    "bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-300",
  low: "bg-gray-500/20 text-gray-700 dark:bg-gray-500/30 dark:text-gray-300",

  "in progress":
    "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300",
  "in-progress":
    "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300",
  blocked: "bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-300",
  "needs review":
    "bg-purple-500/20 text-purple-700 dark:bg-purple-500/30 dark:text-purple-300",
  ready:
    "bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-300",

  security: "bg-red-600/20 text-red-800 dark:bg-red-600/30 dark:text-red-200",
  performance:
    "bg-orange-500/20 text-orange-700 dark:bg-orange-500/30 dark:text-orange-300",
  ui: "bg-pink-500/20 text-pink-700 dark:bg-pink-500/30 dark:text-pink-300",
  ux: "bg-pink-500/20 text-pink-700 dark:bg-pink-500/30 dark:text-pink-300",
  design: "bg-pink-500/20 text-pink-700 dark:bg-pink-500/30 dark:text-pink-300",
  backend:
    "bg-indigo-500/20 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-300",
  frontend:
    "bg-teal-500/20 text-teal-700 dark:bg-teal-500/30 dark:text-teal-300",
  api: "bg-indigo-500/20 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-300",
  database:
    "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300",
  devops:
    "bg-slate-500/20 text-slate-700 dark:bg-slate-500/30 dark:text-slate-300",
  infrastructure:
    "bg-slate-500/20 text-slate-700 dark:bg-slate-500/30 dark:text-slate-300",
};

export function getLabelColor(label: string): string {
  const labelLower = label.toLowerCase();

  if (labelColors[labelLower]) {
    return labelColors[labelLower];
  }

  for (const [key, color] of Object.entries(labelColors)) {
    if (labelLower.includes(key)) {
      return color;
    }
  }

  return "bg-primary-200 dark:bg-primary-500/40 text-primary-600 dark:text-primary-100";
}

export function parseLabels(labels: string | null): string[] {
  if (!labels) return [];
  try {
    const parsed = JSON.parse(labels);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getContextIssueColor(
  labels: string | null,
  provider: string,
): string {
  const parsedLabels = parseLabels(labels);

  if (parsedLabels.length > 0) {
    const firstLabel = parsedLabels[0];
    return getLabelColor(firstLabel);
  }

  switch (provider) {
    case "github":
      return "bg-gray-500/15 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300";
    case "linear":
      return "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300";
    case "jira":
      return "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
    default:
      return "bg-purple-500/10 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300";
  }
}
