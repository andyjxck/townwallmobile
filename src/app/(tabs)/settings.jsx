import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Bell,
  Shield,
  HelpCircle,
  Info,
  AlertCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleSettingPress = (title) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Coming soon",
      `${title} settings will be available in a future update`,
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <StatusBar style="light" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingBottom: 16,
          paddingHorizontal: 20,
          borderBottomWidth: 0.5,
          borderBottomColor: "rgba(255,255,255,0.06)",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 16 }}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 28,
            fontWeight: "700",
            letterSpacing: -0.5,
          }}
        >
          Settings
        </Text>
      </View>

      <ScrollView>
        {/* Notifications */}
        <TouchableOpacity
          onPress={() => handleSettingPress("Notifications")}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 18,
            borderBottomWidth: 0.5,
            borderBottomColor: "rgba(255,255,255,0.06)",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Bell size={22} color="rgba(255,255,255,0.8)" />
          <Text
            style={{ color: "#FFFFFF", fontSize: 16, marginLeft: 16, flex: 1 }}
          >
            Notifications
          </Text>
        </TouchableOpacity>

        {/* Privacy */}
        <TouchableOpacity
          onPress={() => handleSettingPress("Privacy")}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 18,
            borderBottomWidth: 0.5,
            borderBottomColor: "rgba(255,255,255,0.06)",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Shield size={22} color="rgba(255,255,255,0.8)" />
          <Text
            style={{ color: "#FFFFFF", fontSize: 16, marginLeft: 16, flex: 1 }}
          >
            Privacy
          </Text>
        </TouchableOpacity>

        {/* Help */}
        <TouchableOpacity
          onPress={() => handleSettingPress("Help")}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 18,
            borderBottomWidth: 0.5,
            borderBottomColor: "rgba(255,255,255,0.06)",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <HelpCircle size={22} color="rgba(255,255,255,0.8)" />
          <Text
            style={{ color: "#FFFFFF", fontSize: 16, marginLeft: 16, flex: 1 }}
          >
            Help & Support
          </Text>
        </TouchableOpacity>

        {/* About */}
        <TouchableOpacity
          onPress={() => handleSettingPress("About")}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 18,
            borderBottomWidth: 0.5,
            borderBottomColor: "rgba(255,255,255,0.06)",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Info size={22} color="rgba(255,255,255,0.8)" />
          <Text
            style={{ color: "#FFFFFF", fontSize: 16, marginLeft: 16, flex: 1 }}
          >
            About Redditch'd
          </Text>
        </TouchableOpacity>

        {/* Community Guidelines */}
        <TouchableOpacity
          onPress={() => handleSettingPress("Community Guidelines")}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 18,
            borderBottomWidth: 0.5,
            borderBottomColor: "rgba(255,255,255,0.06)",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <AlertCircle size={22} color="rgba(255,255,255,0.8)" />
          <Text
            style={{ color: "#FFFFFF", fontSize: 16, marginLeft: 16, flex: 1 }}
          >
            Community Guidelines
          </Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 40 }}>
          <Text
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            Redditch'd
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.2)",
              fontSize: 12,
              textAlign: "center",
              marginTop: 4,
            }}
          >
            Version 1.0.0
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.2)",
              fontSize: 11,
              textAlign: "center",
              marginTop: 12,
              lineHeight: 16,
            }}
          >
            What's happening around Redditch
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
