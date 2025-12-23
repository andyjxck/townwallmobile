import React from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, LogOut, Shield, Info, Bell, MapPin } from "lucide-react-native";
import { useTheme } from "../utils/theme";
import { useAuth } from "../utils/auth/useAuth";
import * as Haptics from "expo-haptics";

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
            await signOut();
            router.replace("/onboarding/welcome");
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <StatusBar style="light" />

      <View style={{ paddingTop: insets.top + 10 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SETTINGS</Text>
          <View style={{ width: 28 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PREFERENCES</Text>
          <SettingsItem 
            icon={<MapPin size={20} color="rgba(255,255,255,0.4)" />}
            title="Change Default Zone"
            onPress={() => router.push("/onboarding/zones")}
          />
          <SettingsItem 
            icon={<Bell size={20} color={notificationsEnabled ? "#4ADE80" : "rgba(255,255,255,0.4)"} />}
            title={notificationsEnabled ? "Notifications On" : "Notifications Off"}
            onPress={toggleNotifications}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEGAL & ABOUT</Text>
          <SettingsItem 
            icon={<Shield size={20} color="rgba(255,255,255,0.4)" />}
            title="Privacy Policy"
            onPress={() => showLegal("Privacy Policy", "We value your privacy. Your data is never sold or shared with third parties.")}
          />
          <SettingsItem 
            icon={<Info size={20} color="rgba(255,255,255,0.4)" />}
            title="Community Guidelines"
            onPress={() => showLegal("Guidelines", "Be respectful. No hate speech. No spam. Redditch is for everyone.")}
          />
        </View>

        <View style={styles.section}>
          <TouchableOpacity 
            onPress={handleSignOut}
            style={styles.signOutButton}
          >
            <LogOut size={20} color="#FF453A" />
            <Text style={styles.signOutText}>SIGN OUT</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>
          REDDITCH'D v1.0.5{"\n"}
          MADE IN REDDITCH
        </Text>
      </ScrollView>
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
