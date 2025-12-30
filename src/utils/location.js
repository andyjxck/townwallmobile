import * as Location from "expo-location";
import { supabase } from "./supabase";

const UK_COUNTRY_CODES = ["GB", "UK", "United Kingdom", "England", "Scotland", "Wales", "Northern Ireland"];

export async function requestLocationPermission() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.log("Location permission error:", error);
    return false;
  }
}

export async function detectLocation() {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return { success: false, reason: "permission_denied" };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });

    const [reverseGeocode] = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    if (!reverseGeocode) {
      return { success: false, reason: "geocode_failed" };
    }

    const country = reverseGeocode.country || reverseGeocode.isoCountryCode;
    const city = reverseGeocode.city || reverseGeocode.subregion || reverseGeocode.region;

    return {
      success: true,
      country,
      city,
      isUK: isUKLocation(country),
      coords: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
    };
  } catch (error) {
    console.log("Location detection error:", error);
    return { success: false, reason: "detection_failed", error: error.message };
  }
}

export function isUKLocation(country) {
  if (!country) return false;
  const normalizedCountry = country.toLowerCase().trim();
  return UK_COUNTRY_CODES.some(
    (code) => normalizedCountry === code.toLowerCase() || normalizedCountry.includes(code.toLowerCase())
  );
}

export async function fetchCities() {
  try {
    const { data, error } = await supabase
      .from("rcities")
      .select("id, name")
      .eq("is_active", true)
      .eq("country", "UK")
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.log("Fetch cities error:", error);
    return [];
  }
}

export async function fetchZonesForCity(cityId) {
  try {
    const { data, error } = await supabase
      .from("rzones")
      .select("id, name, slug")
      .eq("city_id", cityId)
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.log("Fetch zones error:", error);
    return [];
  }
}

export async function findCityByName(cityName) {
  if (!cityName) return null;
  
  try {
    const { data, error } = await supabase
      .from("rcities")
      .select("id, name")
      .eq("is_active", true)
      .ilike("name", `%${cityName}%`)
      .limit(1)
      .single();

    if (error) return null;
    return data;
  } catch (error) {
    return null;
  }
}

export async function getCityById(cityId) {
  try {
    const { data, error } = await supabase
      .from("rcities")
      .select("id, name")
      .eq("id", cityId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.log("Get city error:", error);
    return null;
  }
}

export async function getZoneById(zoneId) {
  try {
    const { data, error } = await supabase
      .from("rzones")
      .select("id, name, slug, city_id")
      .eq("id", zoneId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.log("Get zone error:", error);
    return null;
  }
}
