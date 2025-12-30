import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useLocationStore = create(
  persist(
    (set, get) => ({
      city_id: 321,
      city_name: "Global",
      city_source: null,
      zone_id: null,
      zone_name: null,
      isLocationSet: false,
      feedView: "global",
      savedCity: null,

        setCity: (city) => {
          if (city.id === 321) {
            set({
              city_id: 321,
              city_name: "Global",
              feedView: "global",
              zone_id: null,
              zone_name: null,
              isLocationSet: true,
            });
          } else {
            set({
              city_id: city.id,
              city_name: city.name,
              city_source: city.source || "manual",
              isLocationSet: true,
              feedView: "city",
              savedCity: city,
            });
          }
        },

      switchToTown: () => {
        const { savedCity } = get();
        if (savedCity) {
          set({
            city_id: savedCity.id,
            city_name: savedCity.name,
            feedView: "city",
          });
        }
      },

      setZone: (zone) =>
        set({
          zone_id: zone?.id || null,
          zone_name: zone?.name || null,
          feedView: zone?.id ? "zone" : get().feedView,
        }),

      setFeedView: (view) => {
        if (view === "global") {
          set({ 
            feedView: "global",
            city_id: 321,
            city_name: "Global",
            zone_id: null,
            zone_name: null 
          });
        } else if (view === "city") {
          const { savedCity } = get();
          if (savedCity) {
            set({ 
              feedView: "city",
              city_id: savedCity.id,
              city_name: savedCity.name
            });
          }
        } else {
          set({ feedView: view });
        }
      },

      clearLocation: () =>
        set({
          city_id: 321,
          city_name: "Global",
          city_source: null,
          zone_id: null,
          zone_name: null,
          isLocationSet: false,
          feedView: "global",
          savedCity: null,
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
