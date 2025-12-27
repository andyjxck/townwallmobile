import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, TextInput, Modal, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, LogOut, Shield, Info, Bell, MapPin, Share as ShareIcon, Key, BarChart2, X } from "lucide-react-native";
import { useTheme } from "../utils/theme";
import { useAuth } from "../utils/auth/useAuth";
import { useAuthStore } from "../utils/auth";
import * as Haptics from "expo-haptics";
import { Share } from "react-native";
import bcrypt from 'bcryptjs';

import { getStoredUser, logoutUser, initUser } from "../utils/user";
import { generateRecoveryCodes, storeRecoveryCodes, getUnusedCodeCount } from "../utils/recoveryCode";
import { RecoveryCodesDisplay } from "../components/RecoveryCodesDisplay";
import { supabase } from "../utils/supabase";

import { LinearGradient } from "expo-linear-gradient";
import { BannerAd } from "@/components/BannerAd";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const { signOut } = useAuth();
  const { auth } = useAuthStore();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRecoveryCodes, setNewRecoveryCodes] = useState([]);
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

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

  const handleRegenerateRecoveryCodes = () => {
    if (!auth?.password) {
      Alert.alert("Not Available", "Recovery codes are only available for accounts with a password.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowPasswordModal(true);
    setCurrentPassword("");
    setPasswordError("");
  };

  const handlePasswordConfirm = async () => {
    if (!currentPassword) {
      setPasswordError("Please enter your password");
      return;
    }

    setRegeneratingCodes(true);
    setPasswordError("");

    try {
      const { data: user } = await supabase
        .from('rusers')
        .select('password')
        .eq('id', auth.id)
        .single();

      if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
        setPasswordError("Incorrect password");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      const codes = generateRecoveryCodes();
      await storeRecoveryCodes(auth.id, codes);
      
      setNewRecoveryCodes(codes);
      setShowPasswordModal(false);
      setShowRecoveryCodes(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setRegeneratingCodes(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    setChangingPassword(true);
    setPasswordError("");
    try {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(newPassword, salt);
      
      const { error } = await supabase
        .from('rusers')
        .update({ password: hashedPassword })
        .eq('id', auth.id);
      
      if (error) throw error;
      
      Alert.alert("Success", "Password changed successfully.");
      setShowChangePassword(false);
      setNewPassword("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error(error);
      setPasswordError("Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRecoveryCodesConfirmed = () => {
    setShowRecoveryCodes(false);
    setNewRecoveryCodes([]);
    Alert.alert("Success", "Your new recovery codes have been saved.");
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

              {auth?.password && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>SECURITY</Text>
                  <SettingsItem 
                    icon={<Key size={20} color="rgba(255,255,255,0.4)" />}
                    title="Change Password"
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowChangePassword(true);
                      setNewPassword("");
                      setPasswordError("");
                    }}
                  />
                  <SettingsItem 
                    icon={<Shield size={20} color="rgba(255,255,255,0.4)" />}
                    title="Regenerate Recovery Codes"
                    onPress={handleRegenerateRecoveryCodes}
                  />
                  <Text style={styles.infoText}>Manage your account access and recovery options.</Text>
                </View>
              )}

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

        <Modal
          visible={showPasswordModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPasswordModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirm Password</Text>
                <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalDescription}>
                Enter your current password to generate new recovery codes. Your existing codes will be invalidated.
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Current password"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoFocus
              />
              {passwordError ? (
                <Text style={styles.errorText}>{passwordError}</Text>
              ) : null}
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={handlePasswordConfirm}
                disabled={regeneratingCodes}
              >
                {regeneratingCodes ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.modalButtonText}>GENERATE NEW CODES</Text>
                )}
              </TouchableOpacity>
            </View>
            </View>
          </Modal>

          <Modal
            visible={showChangePassword}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowChangePassword(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Change Password</Text>
                  <TouchableOpacity onPress={() => setShowChangePassword(false)}>
                    <X size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalDescription}>
                  Enter a new password for your account. It must be at least 6 characters.
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="New password"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoFocus
                />
                {passwordError ? (
                  <Text style={styles.errorText}>{passwordError}</Text>
                ) : null}
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={handleChangePassword}
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <ActivityIndicator color="#000000" />
                  ) : (
                    <Text style={styles.modalButtonText}>UPDATE PASSWORD</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal
            visible={showRecoveryCodes}
            animationType="slide"
            transparent={false}
          >
          <View style={[styles.container, { backgroundColor: '#000000' }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
              <View style={{ width: 28 }} />
              <Text style={styles.headerTitle}>NEW RECOVERY CODES</Text>
              <View style={{ width: 28 }} />
            </View>
            <RecoveryCodesDisplay 
              codes={newRecoveryCodes}
              onConfirm={handleRecoveryCodesConfirmed}
              isRegeneration={true}
            />
          </View>
        </Modal>
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  modalDescription: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 12,
  },
});
