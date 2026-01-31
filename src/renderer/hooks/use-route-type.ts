import { useLocation } from "react-router-dom";
import { useMemo } from "react";
import { getRouteType, type RouteType } from "@/lib/route-utils";

/**
 * Hook to get the current route type
 * Returns the route type based on the current pathname
 */
export function useRouteType(): RouteType {
  const location = useLocation();
  
  return useMemo(() => {
    return getRouteType(location.pathname);
  }, [location.pathname]);
}
