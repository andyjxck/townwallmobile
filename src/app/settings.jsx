import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, TextInput, Modal, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, LogOut, Shield, Info, Bell, Key, BarChart2, X, ChevronRight } from "lucide-react-native";
import { useTheme } from "../utils/theme";
import { useAuth } from "../utils/auth/useAuth";
import { useAuthStore } from "../utils/auth";
import * as Haptics from "expo-haptics";
import { Share } from "react-native";
import bcrypt from 'bcryptjs';
import { getStoredUser, logoutUser, initUser } from "../utils/user";
import { generateRecoveryCodes, storeRecoveryCodes } from "../utils/recoveryCode";
import { RecoveryCodesDisplay } from "../components/RecoveryCodesDisplay";
import { supabase } from "../utils/supabase";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius, typography } = useTheme();
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
      const { data: user } = await supabase.from('rusers').select('password').eq('id', auth.id).single();
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
    } catch (error) { setPasswordError("Something went wrong."); }
    finally { setRegeneratingCodes(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { setPasswordError("Min 6 characters."); return; }
    setChangingPassword(true);
    setPasswordError("");
    try {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(newPassword, salt);
      await supabase.from('rusers').update({ password: hashedPassword }).eq('id', auth.id);
      Alert.alert("Success", "Password changed.");
      setShowChangePassword(false);
      setNewPassword("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) { setPasswordError("Failed to change password."); }
    finally { setChangingPassword(false); }
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
        await logoutUser();
        await signOut();
        await initUser();
        router.replace("/onboarding/welcome");
      }}
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, ...typography.h3 }]}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PREFERENCES</Text>
          <SettingsItem icon={<BarChart2 size={20} color={colors.textTertiary} />} title="Polls & Features" onPress={() => router.push("/polls")} colors={colors} />
          <SettingsItem icon={<Bell size={20} color={notificationsEnabled ? colors.success : colors.textTertiary} />} title="Notifications" onPress={() => setNotificationsEnabled(!notificationsEnabled)} colors={colors} />
        </View>

        {auth?.password && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>SECURITY</Text>
            <SettingsItem icon={<Key size={20} color={colors.textTertiary} />} title="Change Password" onPress={() => { setShowChangePassword(true); setPasswordError(""); }} colors={colors} />
            <SettingsItem icon={<Shield size={20} color={colors.textTertiary} />} title="Recovery Codes" onPress={handleRegenerateRecoveryCodes} colors={colors} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>LEGAL</Text>
          <SettingsItem icon={<Shield size={20} color={colors.textTertiary} />} title="Privacy Policy" onPress={() => {}} colors={colors} />
          <SettingsItem icon={<Info size={20} color={colors.textTertiary} />} title="Guidelines" onPress={() => {}} colors={colors} />
        </View>

        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <LogOut size={20} color={colors.danger} />
          <Text style={[styles.signOutText, { color: colors.danger }]}>SIGN OUT</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.textTertiary }]}>TOWN WALL v1.0.5</Text>
      </ScrollView>

      {/* Modals */}
      <Modal visible={showPasswordModal || showChangePassword} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{showChangePassword ? "New Password" : "Confirm Identity"}</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder={showChangePassword ? "Enter new password" : "Enter current password"}
              placeholderTextColor={colors.textTertiary}
              value={showChangePassword ? newPassword : currentPassword}
              onChangeText={showChangePassword ? setNewPassword : setCurrentPassword}
              secureTextEntry
              autoFocus
            />
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            <TouchableOpacity 
              style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              onPress={showChangePassword ? handleChangePassword : handlePasswordConfirm}
              disabled={regeneratingCodes || changingPassword}
            >
              <Text style={styles.modalBtnText}>{showChangePassword ? "UPDATE" : "CONFIRM"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowPasswordModal(false); setShowChangePassword(false); }} style={styles.closeBtn}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showRecoveryCodes} animationType="fade">
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.text, flex: 1, textAlign: 'center' }]}>New Recovery Codes</Text>
          </View>
          <RecoveryCodesDisplay codes={newRecoveryCodes} onConfirm={() => setShowRecoveryCodes(false)} isRegeneration />
        </View>
      </Modal>
    </View>
  );
}

function SettingsItem({ icon, title, onPress, colors }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.item, { borderBottomColor: colors.separator }]}>
      <View style={styles.itemLeft}>
        {icon}
        <Text style={[styles.itemTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <ChevronRight size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { fontWeight: '800' },
  section: { marginTop: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, paddingHorizontal: 20, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  itemTitle: { fontSize: 16, fontWeight: '600' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 24, marginTop: 24 },
  signOutText: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  version: { textAlign: 'center', fontSize: 11, fontWeight: '700', marginTop: 40, letterSpacing: 1 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 24, padding: 24, borderWidth: 1, gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  modalInput: { borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1 },
  modalBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: '#FFF', fontWeight: '800', letterSpacing: 1 },
  closeBtn: { alignItems: 'center', padding: 8 },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center' },
});
