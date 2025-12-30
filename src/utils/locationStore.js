import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useLocationStore = create(
  persist(
    (set, get) => ({
      city_id: null,
      city_name: null,
      city_source: null,
      zone_id: null,
      zone_name: null,
      isLocationSet: false,
      feedView: "city",

      setCity: (city) =>
        set({
          city_id: city.id,
          city_name: city.name,
          city_source: city.source || "manual",
          isLocationSet: true,
        }),

      setZone: (zone) =>
        set({
          zone_id: zone?.id || null,
          zone_name: zone?.name || null,
        }),

      setFeedView: (view) =>
        set({
          feedView: view,
        }),

      clearLocation: () =>
        set({
          city_id: null,
          city_name: null,
          city_source: null,
          zone_id: null,
          zone_name: null,
          isLocationSet: false,
          feedView: "global",
        }),

      updateCitySource: (source) =>
        set({
          city_source: source,
        }),
    }),
    {
      name: "townwall-location",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const getLocationState = () => useLocationStore.getState();
