import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Refresh } from "../../../components/ui/icons";
import { Button } from "@/components/ui/button";

function getWeatherIcon(code?: number): WeatherIcon {
  if (code == null) return DEFAULT_WEATHER_ICON;
  return WEATHER_CODE_MAP[code] ?? DEFAULT_WEATHER_ICON;
}

async function getUserPosition(): Promise<GeolocationPosition | null> {
  if (!("geolocation" in navigator)) {
    console.warn("Geolocation not available in this browser");
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => {
        console.warn("Geolocation error:", error.message);
        resolve(null);
      },
      { timeout: GEOLOCATION_TIMEOUT }
    );
  });
}

async function fetchWeatherData(
  coords: Coordinates
): Promise<CurrentWeather | null> {
  try {
    const url = `${WEATHER_SITE_URL}/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Weather API responded with status ${response.status}`);
    }

    const json = await response.json();
    const currentWeather = json?.current_weather;

    if (!currentWeather) {
      throw new Error("No current weather data in response");
    }

    return {
      temperature: currentWeather.temperature ?? NaN,
      windspeed: currentWeather.windspeed,
      weathercode: currentWeather.weathercode,
    };
  } catch (error) {
    console.error("Failed to fetch weather data:", error);
    return null;
  }
}

function formatTemperature(temp: number): string {
  return `${Math.round(temp)}°`;
}

function formatCoordinates(coords: Coordinates): string {
  return `lat:${coords.lat.toFixed(2)} lon:${coords.lon.toFixed(2)}`;
}

export default function WeatherWidget() {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [data, setData] = useState<CurrentWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [aiInsight, setAiInsight] = useState<string>("");
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fallbackLocation = useMemo(() => DEFAULT_LOCATION, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeWeather() {
      const position = await getUserPosition();
      const userCoords: Coordinates = {
        lat: position?.coords.latitude ?? fallbackLocation.lat,
        lon: position?.coords.longitude ?? fallbackLocation.lon,
      };

      if (!isMounted) return;
      setCoords(userCoords);

      const weatherData = await fetchWeatherData(userCoords);

      if (!isMounted) return;
      setData(weatherData);
      setLoading(false);
    }

    initializeWeather();

    return () => {
      isMounted = false;
    };
  }, [fallbackLocation]);

  const temperatureDisplay = data ? formatTemperature(data.temperature) : "—";
  const { icon, label } = getWeatherIcon(data?.weathercode);
  const tooltipText = coords
    ? formatCoordinates(coords)
    : "Location unavailable";

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!coords || isRefreshing) return;
    
    setIsRefreshing(true);
    setAiInsight("");
    
    const weatherData = await fetchWeatherData(coords);
    setData(weatherData);
    
    if (isExpanded && weatherData) {
      setLoadingInsight(true);
      try {
        const response = await window.api.ollama.getWeatherInsight({
          temperature: weatherData.temperature,
          weatherCode: weatherData.weathercode || 0,
          windspeed: weatherData.windspeed,
          location: coords,
        });

        setAiInsight(response.success ? (response.data?.insight || "Have a great day!") : "Have a great day!");
      } catch (error) {
        console.error("Failed to fetch AI insight:", error);
        setAiInsight("Unable to fetch insight at this time.");
      } finally {
        setLoadingInsight(false);
      }
    }
    
    setIsRefreshing(false);
  };

  const handleWidgetClick = async () => {
    if (!isExpanded && data && coords && !aiInsight) {
      setIsExpanded(true);
      setLoadingInsight(true);
      try {
        const response = await window.api.ollama.getWeatherInsight({
          temperature: data.temperature,
          weatherCode: data.weathercode || 0,
          windspeed: data.windspeed,
          location: coords,
        });

        setAiInsight(response.success ? (response.data?.insight || "Have a great day!") : "Have a great day!");
      } catch (error) {
        console.error("Failed to fetch AI insight:", error);
        setAiInsight("Unable to fetch insight at this time.");
      } finally {
        setLoadingInsight(false);
      }
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <motion.div
      className=" bg-primary-50/70 rounded-2xl dark:bg-primary-900/70 backdrop-blur border border-primary-200/60 dark:border-primary-900 text-sm cursor-pointer overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label={
        loading ? "Loading weather" : `${temperatureDisplay} ${label}`
      }
      title={tooltipText}
      onClick={handleWidgetClick}
      animate={{
        width: isExpanded ? "280px" : "70px",
        height: isExpanded ? "170px" : "40px",
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 35,
        mass: 0.8,
      }}
      style={{
        originX: 1,
        originY: 0,
      }}
      layout
    >
      <div className="py-2.25 pl-3.5 pr-2 min-w-17 h-9.5 ">
        <div className="flex items-center gap-1.5 rounded-2xl ">
          <span aria-hidden="true" className="text-sm">
            {icon}
          </span>
          <span className="text-sm">
            {loading ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
              </span>
            ) : (
              temperatureDisplay
            )}
          </span>
          {isExpanded ? (
            <Button
              onClick={handleRefresh}
              className="absolute z-40 top-2 right-2 p-1 rounded-full hover:bg-primary-200/50 dark:hover:bg-primary-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh weather data"
              disabled={isRefreshing || loadingInsight}
            >
              <Refresh className={`w-4 h-4 text-primary-700 dark:text-primary-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          ) : null}
        </div>

        <AnimatePresence mode="popLayout">
          {isExpanded && !loading && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{
                opacity: { duration: 0.15 },
                y: { duration: 0.2 },
              }}
              className="mt-3 space-y-2"
            >
              <div className="text-sm px-1 font-medium text-primary-600 dark:text-primary-400">
                {label} |{" "}
                {data?.windspeed && (
                  <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                    Wind: {Math.round(data.windspeed)} km/h
                  </span>
                )}
              </div>

              <div className=" mt-3 pt-2 border-t border-primary-200/50 dark:border-primary-500/50">
                {loadingInsight ? (
                  <div className=" flex items-center gap-2 text-xs text-primary-500">
                    <span className="h-3 w-3 animate-spin rounded-full border border-primary-500 border-t-transparent" />
                    <div className="shine-text text-xs">
                      Fetching weather insight...
                    </div>
                  </div>
                ) : aiInsight ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-primary-700 dark:text-primary-300 leading-relaxed"
                  >
                    {aiInsight}
                  </motion.div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

type CurrentWeather = {
  temperature: number;
  windspeed?: number;
  weathercode?: number;
};

type Coordinates = {
  lat: number;
  lon: number;
};

export const DEFAULT_LOCATION = {
  lat: 41.0082,
  lon: 28.9784,
};

export const GEOLOCATION_TIMEOUT = 5000;

type WeatherIcon = {
  icon: string;
  label: string;
};

export const WEATHER_CODE_MAP: Record<number, WeatherIcon> = {
  0: { icon: "☀️", label: "Clear" },
  1: { icon: "🌤️", label: "Partly Cloudy" },
  2: { icon: "🌤️", label: "Partly Cloudy" },
  3: { icon: "🌤️", label: "Partly Cloudy" },
  45: { icon: "🌫️", label: "Foggy" },
  48: { icon: "🌫️", label: "Foggy" },
  51: { icon: "🌧️", label: "Light Rain" },
  53: { icon: "🌧️", label: "Moderate Rain" },
  55: { icon: "🌧️", label: "Heavy Rain" },
  56: { icon: "🌧️", label: "Freezing Rain" },
  57: { icon: "🌧️", label: "Freezing Rain" },
  61: { icon: "🌧️", label: "Light Rain" },
  63: { icon: "🌧️", label: "Moderate Rain" },
  65: { icon: "🌧️", label: "Heavy Rain" },
  71: { icon: "❄️", label: "Light Snow" },
  73: { icon: "❄️", label: "Moderate Snow" },
  75: { icon: "❄️", label: "Heavy Snow" },
  77: { icon: "❄️", label: "Snow Grains" },
  80: { icon: "🌦️", label: "Light Showers" },
  81: { icon: "🌦️", label: "Moderate Showers" },
  82: { icon: "🌦️", label: "Heavy Showers" },
  85: { icon: "❄️", label: "Snow Showers" },
  86: { icon: "❄️", label: "Snow Showers" },
  95: { icon: "⛈️", label: "Thunderstorm" },
  96: { icon: "⛈️", label: "Thunderstorm" },
  99: { icon: "⛈️", label: "Thunderstorm" },
};

export const DEFAULT_WEATHER_ICON = {
  icon: "",
  label: "Unknown",
};

export const WEATHER_SITE_URL = "https://api.open-meteo.com/v1";
