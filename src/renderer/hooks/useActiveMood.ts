import { useMemo } from "react";
import { useGetAppSettingsQuery, useGetMoodsQuery } from "@/lib/redux/api";

/**
 * Hook to get the currently active mood
 * @returns {object} Object containing active mood data
 * @returns {string} activeMoodId - ID of the active mood
 * @returns {object|undefined} activeMood - Full mood object if found
 * @returns {boolean} isJournalMood - True if active mood is journal mood
 * @returns {string|undefined} moodSlug - Slug of the active mood
 */
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
