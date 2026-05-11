import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui";
import {
  SettingsPageShell,
} from "./settings-layout";
import {
  useArchiveSpaceMutation,
  useGetProviderByIdQuery,
  useGetSpacesQuery,
  useSetActiveSpaceMutation,
  useUnarchiveSpaceMutation,
  useUpdateProviderMutation,
} from "@/lib/redux/api";
import { getSpaceDefaultRoute } from "@/lib/route-utils";

type ProviderData = ReturnType<typeof useGetProviderByIdQuery>["data"];

export function useProviderSettings<TConfig extends object = Record<string, unknown>>(
  providerId: string,
  spaceSlug: string,
) {
  const navigate = useNavigate();
  const {
    data: provider,
    isLoading,
    error,
  } = useGetProviderByIdQuery(providerId);
  const [updateProvider, { isLoading: updating }] = useUpdateProviderMutation();
  const { data: spaces = [] } = useGetSpacesQuery();
  const [archiveSpace] = useArchiveSpaceMutation();
  const [unarchiveSpace] = useUnarchiveSpaceMutation();
  const [setActiveSpace] = useSetActiveSpaceMutation();

  const space = spaces.find((s) => s.slug === spaceSlug);
  const otherVisibleSpaces = spaces.filter(
    (s) => s.slug !== spaceSlug && !s.isArchived,
  );
  const canHide = otherVisibleSpaces.length > 0;
  const config = (provider?.config ?? {}) as TConfig;

  const updateConfig = async (patch: Partial<TConfig>) => {
    if (!provider || updating) return false;
    try {
      await updateProvider({
        id: providerId,
        payload: { config: { ...config, ...patch } },
      }).unwrap();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to update setting");
      return false;
    }
  };

  const setSpaceVisible = async (visible: boolean) => {
    if (!space) return;

    try {
      if (visible) {
        await unarchiveSpace(space.id).unwrap();
        toast.success("Space is now visible");
      } else {
        await archiveSpace(space.id).unwrap();
        const target = otherVisibleSpaces[0];
        if (target) {
          await setActiveSpace(target.id).unwrap();
          const route = getSpaceDefaultRoute(target);
          setTimeout(() => navigate(route, { replace: true }), 0);
        }
        toast.success("Space hidden");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update space visibility");
    }
  };

  return {
    provider,
    isLoading,
    error,
    updating,
    config,
    space,
    canHide,
    updateConfig,
    setSpaceVisible,
  };
}

export function ProviderSettingsLayout({
  title,
  provider,
  isLoading,
  error,
  children,
  className = "",
}: {
  title: string;
  provider: ProviderData;
  isLoading: boolean;
  error: unknown;
  children: ReactNode;
  className?: string;
}) {
  const missingProvider = !isLoading && !error && !provider;

  return (
    <SettingsPageShell
      title={title}
      isLoading={isLoading}
      error={error || missingProvider || undefined}
      errorMessage={`${title} provider not found. Make sure it is configured in the database.`}
      className={className}
    >
      {children}
    </SettingsPageShell>
  );
}
