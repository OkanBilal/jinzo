import { useMemo } from "react";
import { useGetAppSettingsQuery, useGetSpacesQuery } from "@/lib/redux/api";

export function useActiveSpace() {
  const { data: appSettings } = useGetAppSettingsQuery();
  const { data: spaces = [] } = useGetSpacesQuery();

  const activeSpaceId = appSettings?.activeSpaceId || "";

  const activeSpace = useMemo(() => {
    return spaces.find((m) => m.id === activeSpaceId);
  }, [spaces, activeSpaceId]);

  const spaceSlug = activeSpace?.slug;
  const isJournalSpace = spaceSlug === "journal";
  const isClaudeSpace = spaceSlug === "claude";

  return {
    activeSpaceId,
    activeSpace,
    spaceSlug,
    isJournalSpace,
    isClaudeSpace,
    spaces,
  };
}
