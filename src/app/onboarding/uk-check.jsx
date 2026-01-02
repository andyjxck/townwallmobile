import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Globe } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/utils/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import { useLocationStore } from "@/utils/locationStore";
import { setOnboardingComplete } from "@/utils/onboarding";

export default function UKCheckScreen() {
  const { isHippie } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setFeedView, setCity } = useLocationStore();

  const handleYes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/onboarding/city");
  };

  const handleNo = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFeedView("global");
    setCity({
      id: 321,
      name: "Global",
      source: "manual",
    });
    await setOnboardingComplete(true);
    router.replace("/");
  };

  return (
    <View style={{ flex: 1, backgroundColor: isHippie ? 'transparent' : "#000000" }}>
      {!isHippie && (
        <LinearGradient
          colors={['#0F172A', '#000000']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <StatusBar style="light" />

      <View
        style={{ flex: 1, paddingTop: insets.top + 60, paddingHorizontal: 24, justifyContent: 'center' }}
      >
        <View style={{ alignItems: 'center', marginBottom: 60 }}>
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: "rgba(74, 222, 128, 0.1)",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 32,
            }}
          >
            <Globe size={50} color="#4ADE80" />
          </View>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 32,
              fontWeight: "800",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            Are you from the UK?
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 16,
              textAlign: "center",
              lineHeight: 24,
            }}
          >
            Town Wall currently has local communities in the UK
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <TouchableOpacity
            onPress={handleYes}
            style={{
              backgroundColor: "#4ADE80",
              paddingVertical: 18,
              borderRadius: 16,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#000000",
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              Yes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNo}
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              paddingVertical: 18,
              borderRadius: 16,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.2)",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              No
            </Text>
          </TouchableOpacity>
        </View>

        <Text
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: 14,
            textAlign: "center",
            marginTop: 40,
            lineHeight: 20,
          }}
        >
          If you're not from the UK, you'll join our Global Chat to connect with people worldwide
        </Text>
      </View>

      <View style={{ paddingBottom: insets.bottom + 24 }} />
    </View>
  );
}
