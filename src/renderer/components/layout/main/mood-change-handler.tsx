import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { baseApi } from "@/lib/redux/api/baseApi";

export function MoodChangeHandler() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const sidebarConfig = useSidebarConfig();

  useEffect(() => {
    const unsubscribe = window.api.appSettings.onMoodChanged(() => {
      dispatch(baseApi.util.invalidateTags(["AppSettings"]));
      navigate(sidebarConfig.defaultRoute);
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch, navigate, sidebarConfig.defaultRoute]);

  return null;
}
