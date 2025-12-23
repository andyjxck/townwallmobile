import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Search, Check } from "lucide-react-native";
import { completeOnboarding } from "@/utils/onboarding";
import * as Haptics from "expo-haptics";

const ZONES = [
  { id: 1, name: "Astwood Bank & Feckenham" },
  { id: 2, name: "Batchley & Brockhill" },
  { id: 3, name: "Central" },
  { id: 4, name: "Greenlands & Lakeside" },
  { id: 5, name: "Headless Cross & Oakenshaw" },
  { id: 6, name: "Matchborough & Woodrow" },
  { id: 7, name: "North" },
  { id: 8, name: "Webheath & Callow Hill" },
  { id: 9, name: "Winyates" },
];

export default function ZonesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedZone, setSelectedZone] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredZones = ZONES.filter((zone) =>
    zone.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleContinue = async () => {
    if (!selectedZone) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeOnboarding(selectedZone.id);
    router.replace("/(tabs)/central");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <StatusBar style="light" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 40,
          paddingHorizontal: 24,
          paddingBottom: 24,
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 32,
            fontWeight: "700",
            letterSpacing: -0.5,
            marginBottom: 8,
          }}
        >
          Choose Your Zone
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 15,
            lineHeight: 22,
          }}
        >
          This will be your default feed when you open the app
        </Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Search size={20} color="rgba(255,255,255,0.4)" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search zones"
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={{
              flex: 1,
              color: "#FFFFFF",
              fontSize: 16,
              marginLeft: 12,
            }}
          />
        </View>
      </View>

      {/* Zones List */}
      <ScrollView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingBottom: 160 }}>
          {filteredZones.map((zone, index) => (
            <TouchableOpacity
              key={zone.id}
              onPress={() => {
                setSelectedZone(zone);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={{
                paddingVertical: 18,
                borderBottomWidth: index < filteredZones.length - 1 ? 0.5 : 0,
                borderBottomColor: "rgba(255,255,255,0.06)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 17,
                  fontWeight: selectedZone?.id === zone.id ? "600" : "400",
                }}
              >
                {zone.name}
              </Text>
              {selectedZone?.id === zone.id && (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: "#4ADE80",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Check size={16} color="#000000" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: insets.bottom + 24,
          backgroundColor: "#000000",
          borderTopWidth: 0.5,
          borderTopColor: "rgba(255,255,255,0.06)",
        }}
      >
        <TouchableOpacity
          onPress={handleContinue}
          disabled={!selectedZone}
          style={{
            backgroundColor: selectedZone ? "#FFFFFF" : "rgba(255,255,255,0.1)",
            paddingVertical: 18,
            borderRadius: 16,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: selectedZone ? "#000000" : "rgba(255,255,255,0.3)",
              fontSize: 17,
              fontWeight: "700",
            }}
          >
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
