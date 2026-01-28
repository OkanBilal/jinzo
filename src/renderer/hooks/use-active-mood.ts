import { useMemo } from "react";
import { useGetAppSettingsQuery, useGetMoodsQuery } from "@/lib/redux/api";

export function useActiveMood() {
  const { data: appSettings } = useGetAppSettingsQuery();
  const { data: moods = [] } = useGetMoodsQuery();

  const activeMoodId = appSettings?.activeMoodId || "";
  
  const activeMood = useMemo(() => {
    return moods.find((m) => m.id === activeMoodId);
  }, [moods, activeMoodId]);

  const moodSlug = activeMood?.slug;
  const isJournalMood = moodSlug === "journal";
  const isClaudeMood = moodSlug === "claude";

  return {
    activeMoodId,
    activeMood,
    moodSlug,
    isJournalMood,
    isClaudeMood,
    moods,
  };
}
