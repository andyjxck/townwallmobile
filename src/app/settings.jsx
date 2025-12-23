import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { InstrumentSans_500Medium } from "@expo-google-fonts/instrument-sans";
import { useTheme } from "@/utils/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    InstrumentSans_500Medium,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>

        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 17,
            color: colors.text,
            marginLeft: 12,
          }}
        >
          Settings
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: 24 }}>
          <SectionHeader title="General" colors={colors} />

          <SettingsItem
            title="Home Zone"
            subtitle="Change your default zone"
            colors={colors}
            onPress={() => {}}
          />

          <SettingsItem
            title="Notifications"
            subtitle="Manage alert preferences"
            colors={colors}
            onPress={() => {}}
          />

          <SectionHeader title="About" colors={colors} />

          <SettingsItem
            title="How It Works"
            subtitle="Learn about reactions and moderation"
            colors={colors}
            onPress={() => {}}
          />

          <SettingsItem
            title="Community Guidelines"
            subtitle="What's allowed and what's not"
            colors={colors}
            onPress={() => {}}
          />

          <SettingsItem
            title="Privacy"
            subtitle="How we handle your data"
            colors={colors}
            onPress={() => {}}
          />

          <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: colors.textTertiary,
                textAlign: "center",
              }}
            >
              Redditch'd v1.0{"\n"}
              What's happening around Redditch
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, colors }) {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 8,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 13,
          color: colors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function SettingsItem({ title, subtitle, colors, onPress }) {
  return (
    <>
      <TouchableOpacity
        onPress={onPress}
        style={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 17,
              color: colors.text,
              marginBottom: 2,
            }}
          >
            {title}
          </Text>

          {subtitle && (
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: colors.textSecondary,
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>

        <ChevronRight size={20} color={colors.textTertiary} />
      </TouchableOpacity>

      <View
        style={{
          height: 1,
          backgroundColor: colors.separator,
          marginHorizontal: 20,
        }}
      />
    </>
  );
}
