import { formatDistanceToNow, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";

export function formatDate(date: string): string {
  return formatDistanceToNow(parseISO(date), {
    locale: enUS,
  });
}
