import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { setOnboardingComplete } from "@/utils/onboarding";
import { useTheme } from "@/utils/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { MapPin, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useLocationStore } from "@/utils/locationStore";
import { fetchZonesForCity } from "@/utils/location";

export default function ZonesScreen() {
  const { isHippie } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { city_id, city_name, setZone } = useLocationStore();

  useEffect(() => {
    if (!city_id) {
      router.replace("/onboarding/city");
      return;
    }
    loadZones();
  }, [city_id]);

  const loadZones = async () => {
    try {
      const zonesData = await fetchZonesForCity(city_id);
      setZones(zonesData || []);
    } catch (err) {
      console.error("Error fetching zones:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectZone = async (zone) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setZone({ id: zone.id, name: zone.name });
    await setOnboardingComplete(true);
    router.replace("/");
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setZone(null);
    await setOnboardingComplete(true);
    router.replace("/");
  };

  return (
    <View style={[styles.container, isHippie && { backgroundColor: 'transparent' }]}>
      <StatusBar style="light" />
      {!isHippie && (
        <LinearGradient
          colors={["#0F172A", "#000000"]}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Pick your area</Text>
          <Text style={styles.subtitle}>
            Connect with people and updates in your specific part of {city_name || "town"}.
          </Text>
          <Text style={styles.hint}>
            This helps keep posts relevant to your local area
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          >
            <View style={styles.zoneList}>
              {zones.map((zone) => (
                <TouchableOpacity
                  key={zone.id}
                  style={styles.zoneItem}
                  onPress={() => handleSelectZone(zone)}
                >
                  <View style={styles.zoneIcon}>
                    <MapPin size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.zoneName}>{zone.name}</Text>
                  <ChevronRight size={20} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
          >
            <Text style={styles.skipText}>I don't want to say</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 24,
  },
  hint: {
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
    marginTop: 8,
    lineHeight: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  zoneList: {
    gap: 12,
  },
  zoneItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  zoneIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  zoneName: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.9)",
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  skipText: {
    fontSize: 16,
    color: "#4ADE80",
    fontWeight: "500",
  },
});
