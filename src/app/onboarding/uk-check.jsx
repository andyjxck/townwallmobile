import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Globe, MapPin } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/utils/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import { useChatStore, useAuthStore } from "@/utils/auth";

export default function UkCheckScreen() {
  const { isHippie } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const auth = useAuthStore((state) => state.auth);

  const handleYes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/onboarding/city");
  };

  const handleNo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (auth) {
      router.push("/onboarding/city?global=true");
    } else {
      router.push("/auth?global=true");
    }
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
        style={{ flex: 1, paddingTop: insets.top + 80, paddingHorizontal: 24 }}
      >
        <View style={{ alignItems: "center", marginBottom: 60 }}>
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: "rgba(255,255,255,0.06)",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 32,
            }}
          >
            <Text style={{ fontSize: 56 }}>🇬🇧</Text>
          </View>

          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 32,
              fontWeight: "900",
              letterSpacing: -1,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            Are you from the UK?
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 16,
              fontWeight: "500",
              lineHeight: 24,
              textAlign: "center",
              maxWidth: 280,
            }}
          >
            Town Wall is currently focused on UK communities
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <TouchableOpacity
            onPress={handleYes}
            style={{
              backgroundColor: "#FFFFFF",
              paddingVertical: 20,
              borderRadius: 16,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <MapPin size={22} color="#000000" />
            <Text
              style={{
                color: "#000000",
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              Yes, I'm in the UK
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNo}
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              paddingVertical: 20,
              borderRadius: 16,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
            }}
          >
            <Globe size={22} color="#FFFFFF" />
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              No, join Global Chat
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ paddingBottom: insets.bottom + 24, alignItems: "center" }}>
          <Text
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 13,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Non-UK users can still connect with{"\n"}the global community
          </Text>
        </View>
      </View>
    </View>
  );
}
