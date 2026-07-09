export function formatDate(date: string | number | Date): string {
  const now = new Date();
  const past =
    date instanceof Date
      ? date
      : typeof date === "number"
        ? new Date(date < 1e12 ? date * 1000 : date)
        : new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `just now`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays}d ago`;
  }

  return past.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
