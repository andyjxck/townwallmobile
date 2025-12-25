import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, LogOut, Shield, Info, Bell, MapPin, Share as ShareIcon } from "lucide-react-native";
import { useTheme } from "../utils/theme";
import { useAuth } from "../utils/auth/useAuth";
import * as Haptics from "expo-haptics";
import { Share } from "react-native";

import { getStoredUser, logoutUser, initUser } from "../utils/user";

import { LinearGradient } from "expo-linear-gradient";
import { BannerAd } from "@/components/BannerAd";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const { signOut } = useAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const toggleNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotificationsEnabled(!notificationsEnabled);
  };

  const showLegal = (title, content) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(title, content);
  };

  const handleShareApp = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: "Check out Town Wall - the digital town square for our community!",
        url: process.env.EXPO_PUBLIC_APP_URL
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Sign Out", 
          style: "destructive",
          onPress: async () => {
            await logoutUser();
            await signOut();
            await initUser(); // Re-init as anonymous
            router.replace("/onboarding/welcome");
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#000000', '#000000']}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar style="light" />

      <View style={{ paddingTop: insets.top + 10, flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SETTINGS</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
            <BannerAd />
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PREFERENCES</Text>
                <SettingsItem 
                  icon={<BarChart2 size={20} color="rgba(255,255,255,0.4)" />}
                  title="Future Features & Polls"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push("/polls");
                  }}
                />
                <SettingsItem 
                  icon={<Bell size={20} color={notificationsEnabled ? "#4ADE80" : "rgba(255,255,255,0.4)"} />}

                title={notificationsEnabled ? "Notifications On" : "Notifications Off"}
                onPress={toggleNotifications}
              />
              <SettingsItem 
                icon={<ShareIcon size={20} color="rgba(255,255,255,0.4)" />}
                title="Share Town Wall"
                onPress={handleShareApp}
              />
              <Text style={styles.infoText}>Tell your friends about us!</Text>
            </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LEGAL & ABOUT</Text>
            <SettingsItem 
              icon={<Shield size={20} color="rgba(255,255,255,0.4)" />}
              title="Privacy Policy"
              onPress={() => showLegal("Privacy Policy", "Privacy policy and community guidelines will be coming soon")}
            />
            <SettingsItem 
              icon={<Info size={20} color="rgba(255,255,255,0.4)" />}
              title="Community Guidelines"
              onPress={() => showLegal("Guidelines", "Privacy policy and community guidelines will be coming soon")}
            />
          </View>

          <View style={styles.section}>
            <TouchableOpacity 
              onPress={handleSignOut}
              style={styles.signOutButton}
            >
              <LogOut size={20} color="#EF4444" />
              <Text style={styles.signOutText}>SIGN OUT</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.versionText}>
            TOWN WALL v1.0.5{"\n"}
            MADE WITH ❤️ FOR THE COMMUNITY
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

function SettingsItem({ icon, title, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.item}>
      <View style={styles.itemLeft}>
        {icon}
        <Text style={styles.itemTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  section: {
    marginTop: 30,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  item: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  itemTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  infoText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginTop: -5,
    marginBottom: 10,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  signOutText: {
    color: '#FF453A',
    fontSize: 16,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 50,
    lineHeight: 18,
  }
});
