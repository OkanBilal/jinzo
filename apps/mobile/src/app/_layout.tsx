import { Drawer } from "expo-router/drawer";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { backendSession } from "@/backend/backend-session";
import { Sidebar } from "@/components/sidebar";
import { colors, useBrandColors } from "@/theme";

/**
 * Sidebar-first shell, like the desktop and the ChatGPT/Claude apps: an opaque
 * drawer on the plain background holding destinations and recent runs; the
 * main screen slides aside, rounds into a card and dims a little while it is
 * open (see `(main)/_layout.tsx`). No tabs.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  const brand = useBrandColors();

  // The session outlives every screen: it reads the paired Mac from the
  // keychain, keeps the socket alive, and feeds the projection tables.
  useEffect(() => {
    void backendSession.start();
    return () => backendSession.stop();
  }, []);

  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: brand.accent } };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.systemBackground }}>
      <ThemeProvider value={theme}>
        <Drawer
          drawerContent={(props) => <Sidebar navigation={props.navigation} />}
          screenOptions={{
            headerShown: false,
            drawerType: "slide",
            drawerStyle: { width: "82%", backgroundColor: colors.systemBackground },
            // The scene card dims itself (SceneCard); the drawer's own overlay stays clear.
            overlayColor: "transparent",
            sceneStyle: { backgroundColor: "transparent" },
            swipeEdgeWidth: 48,
          }}
        >
          <Drawer.Screen name="(main)" />
        </Drawer>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
