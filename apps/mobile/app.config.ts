import type { ConfigContext, ExpoConfig } from "expo/config";

type AppVariant = "development" | "preview" | "production";

const VARIANTS: Record<
  AppVariant,
  { appName: string; identifier: string; scheme: string }
> = {
  development: {
    appName: "Mains Dev",
    identifier: "dev.mains.mobile.dev",
    scheme: "mains-dev",
  },
  preview: {
    appName: "Mains Preview",
    identifier: "dev.mains.mobile.preview",
    scheme: "mains-preview",
  },
  production: {
    appName: "Mains",
    identifier: "dev.mains.mobile",
    scheme: "mains",
  },
};

function resolveVariant(value: string | undefined): AppVariant {
  if (value === "development" || value === "preview") return value;
  return "production";
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appVariant = resolveVariant(process.env.APP_VARIANT);
  const variant = VARIANTS[appVariant];
  const allowsDevelopmentLan = appVariant !== "production";

  return {
    ...config,
    name: variant.appName,
    slug: "mobile",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: variant.scheme,
    userInterfaceStyle: "dark",
    runtimeVersion: {
      policy: "fingerprint",
    },
    ios: {
      bundleIdentifier: variant.identifier,
      supportsTablet: false,
      icon: "./assets/expo.icon",
      infoPlist: {
        NSLocalNetworkUsageDescription:
          "Mains connects to the companion app running on your Mac.",
        NSAppTransportSecurity: allowsDevelopmentLan
          ? { NSAllowsLocalNetworking: true }
          : undefined,
      },
    },
    android: {
      package: variant.identifier,
      adaptiveIcon: {
        backgroundColor: "#0B0E0D",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: true,
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-image",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#0B0E0D",
          image: "./assets/images/splash-icon.png",
          imageWidth: 76,
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "Mains uses the camera to scan a pairing code shown on your Mac.",
          recordAudioAndroid: false,
        },
      ],
      [
        "expo-notifications",
        {
          color: "#B7F34A",
          icon: "./assets/images/android-icon-monochrome.png",
        },
      ],
      "expo-secure-store",
      "expo-sqlite",
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: allowsDevelopmentLan,
          },
        },
      ],
      "./plugins/with-ios-scene-lifecycle.cjs",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      appVariant,
    },
  };
};
