import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MapPin, ThumbsUp, Flag, Clock } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/onboarding/zones");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <LinearGradient
        colors={['#0F172A', '#000000']}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar style="light" />

      <View
        style={{ flex: 1, paddingTop: insets.top + 60, paddingHorizontal: 24 }}
      >
        {/* Title */}
        <View style={{ marginBottom: 60 }}>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 48,
              fontWeight: "900",
              letterSpacing: -2,
              marginBottom: 8,
            }}
          >
            Town Wall
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 18,
              fontWeight: "500",
              lineHeight: 26,
            }}
          >
            What's happening in your community
          </Text>
        </View>

          {/* Features */}
          <View style={{ gap: 32 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 16,
                }}
              >
                <MapPin size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "600", marginBottom: 6 }}>
                  Connect Locally
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, lineHeight: 22 }}>
                  Your town's digital wall. See real-time updates from neighbors, businesses, and talent.
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 16,
                }}
              >
                <Shield size={22} color="#4ADE80" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "600", marginBottom: 6 }}>
                  Pure Privacy
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, lineHeight: 22 }}>
                  We don't collect emails, numbers, or personal info. Just a username and password. Post anonymously anytime.
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 16,
                }}
              >
                <ThumbsUp size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "600", marginBottom: 6 }}>
                  Community Led
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, lineHeight: 22 }}>
                  Helpful posts rise, misinformation gets flagged. You decide what matters.
                </Text>
              </View>
            </View>
          </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

          {/* Continue Button */}
          <View style={{ paddingBottom: insets.bottom + 24 }}>
            <TouchableOpacity
              onPress={handleContinue}
              style={{
                backgroundColor: "#FFFFFF",
                paddingVertical: 18,
                borderRadius: 16,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: "#000000",
                  fontSize: 17,
                  fontWeight: "700",
                }}
              >
                Get Started
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push("/auth?mode=login")}
              style={{ marginTop: 20, alignItems: "center" }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
                Already have an account? <Text style={{ color: "#4ADE80" }}>Sign in</Text>
              </Text>
            </TouchableOpacity>

            <Text
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                textAlign: "center",
                marginTop: 24,
                lineHeight: 18,
              }}
            >
              By continuing, you agree to our community guidelines
            </Text>
          </View>
      </View>
    </View>
  );
}
