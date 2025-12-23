import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MapPin, ThumbsUp, Flag, Clock } from "lucide-react-native";
import * as Haptics from "expo-haptics";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/onboarding/zones");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
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
              fontWeight: "800",
              letterSpacing: -1.5,
              marginBottom: 12,
            }}
          >
            Redditch'd
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 18,
              lineHeight: 26,
            }}
          >
            What's happening around Redditch
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
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 17,
                  fontWeight: "600",
                  marginBottom: 6,
                }}
              >
                Local & Live
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 15,
                  lineHeight: 22,
                }}
              >
                See what people are posting in your area right now
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
              <View style={{ flexDirection: "row", gap: 4 }}>
                <ThumbsUp size={14} color="#4ADE80" />
                <Flag size={14} color="#EF4444" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 17,
                  fontWeight: "600",
                  marginBottom: 6,
                }}
              >
                Community Truth
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 15,
                  lineHeight: 22,
                }}
              >
                React to posts - the community decides what's real
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
              <Clock size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 17,
                  fontWeight: "600",
                  marginBottom: 6,
                }}
              >
                Fast & Anonymous
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 15,
                  lineHeight: 22,
                }}
              >
                Post without an account. No signup required.
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

          <Text
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
              textAlign: "center",
              marginTop: 16,
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
