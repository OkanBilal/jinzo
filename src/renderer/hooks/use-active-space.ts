import { useMemo } from "react";
import { useGetAppSettingsQuery, useGetSpacesQuery } from "@/lib/redux/api";

export function useActiveSpace() {
  const { data: appSettings } = useGetAppSettingsQuery();
  const { data: allSpaces = [] } = useGetSpacesQuery();

  const activeSpaceId = appSettings?.activeSpaceId || "";

  const spaces = useMemo(() => {
    return allSpaces.filter((s) => !s.isArchived);
  }, [allSpaces]);

  const activeSpace = useMemo(() => {
    return allSpaces.find((m) => m.id === activeSpaceId);
  }, [allSpaces, activeSpaceId]);

  const spaceSlug = activeSpace?.slug;
  const isClaudeSpace = spaceSlug === "claude";

  return {
    activeSpaceId,
    activeSpace,
    spaceSlug,
    isClaudeSpace,
    spaces,
    allSpaces,
  };
}
