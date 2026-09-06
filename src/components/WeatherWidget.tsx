import { useEffect, useState } from "react";
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, Wind, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Weather = {
  temperature: number;
  code: number;
  max: number;
  min: number;
  city: string;
  daily: { date: string; max: number; min: number; code: number }[];
};

const codeIcon = (code: number) => {
  if ([0].includes(code)) return Sun;
  if ([1, 2].includes(code)) return CloudSun;
  if ([3, 45, 48].includes(code)) return Cloud;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return Wind;
  return Cloud;
};

const codeLabel = (code: number) => {
  if (code === 0) return "Clear";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunder";
  return "Cloudy";
};

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`);
    const j = await r.json();
    return j?.results?.[0]?.name ?? "Your location";
  } catch { return "Your location"; }
}

export const WeatherWidget = () => {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "denied" | "loading" | "ready" | "error">("idle");
  const [w, setW] = useState<Weather | null>(null);

  const fetchWeather = async (lat: number, lon: number, city?: string) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5&temperature_unit=fahrenheit`;
      const r = await fetch(url);
      const j = await r.json();
      const daily = (j.daily?.time ?? []).map((d: string, i: number) => ({
        date: d,
        max: Math.round(j.daily.temperature_2m_max[i]),
        min: Math.round(j.daily.temperature_2m_min[i]),
        code: j.daily.weathercode[i],
      }));
      const resolvedCity = city || await reverseGeocode(lat, lon);
      setW({
        temperature: Math.round(j.current_weather.temperature),
        code: j.current_weather.weathercode,
        max: daily[0]?.max ?? 0,
        min: daily[0]?.min ?? 0,
        city: resolvedCity,
        daily,
      });
      setState("ready");
    } catch {
      setState("error");
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) { setState("error"); return; }
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        if (user) {
          await supabase.from("profiles").update({ weather_lat: latitude, weather_lon: longitude }).eq("user_id", user.id);
        }
        fetchWeather(latitude, longitude);
      },
      () => setState("denied"),
      { timeout: 10000, maximumAge: 1000 * 60 * 30 }
    );
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("weather_lat,weather_lon,weather_city").eq("user_id", user.id).maybeSingle();
      if (p?.weather_lat != null && p?.weather_lon != null) {
        setState("loading");
        fetchWeather(Number(p.weather_lat), Number(p.weather_lon), p.weather_city ?? undefined);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (state === "idle" || state === "denied" || state === "error") {
    return (
      <div className="glass-strong p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 text-sm">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">
            {state === "denied" ? "Location denied — enable in browser to see weather." : "Show weather on your calendar?"}
          </span>
        </div>
        <button
          onClick={requestLocation}
          className="text-xs font-semibold bg-gradient-primary text-primary-foreground px-3 py-1.5 rounded-lg shadow-glow"
        >
          Enable weather
        </button>
      </div>
    );
  }

  if (state === "loading" || !w) {
    return (
      <div className="glass-strong p-4 flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading weather...
      </div>
    );
  }

  const Icon = codeIcon(w.code);

  return (
    <div className="glass-strong p-4 rounded-xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-xl bg-gradient-primary/20 grid place-items-center ring-1 ring-white/10">
            <Icon className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="text-3xl font-bold leading-none">{w.temperature}°F</div>
            <div className="text-xs text-muted-foreground mt-1">{codeLabel(w.code)} · {w.city}</div>
            <div className="text-[11px] text-muted-foreground">H: {w.max}° · L: {w.min}°</div>
          </div>
        </div>
        <div className="flex gap-2 flex-1 justify-end min-w-[240px]">
          {w.daily.slice(1, 5).map((d) => {
            const DI = codeIcon(d.code);
            const dayLabel = new Date(d.date).toLocaleDateString("en-US", { weekday: "short" });
            return (
              <div key={d.date} className="glass p-2 rounded-lg text-center min-w-[54px]">
                <div className="text-[10px] text-muted-foreground">{dayLabel}</div>
                <DI className="h-4 w-4 mx-auto my-1 text-primary" />
                <div className="text-[11px] font-semibold">{d.max}°</div>
                <div className="text-[10px] text-muted-foreground">{d.min}°</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
