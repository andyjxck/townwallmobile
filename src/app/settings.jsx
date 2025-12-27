import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, TextInput, Modal, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, LogOut, Shield, Info, Bell, Key, BarChart2, ChevronRight } from "lucide-react-native";
import { theme } from "../utils/theme";
import { useAuth } from "../utils/auth/useAuth";
import { useAuthStore } from "../utils/auth";
import * as Haptics from "expo-haptics";
import bcrypt from 'bcryptjs';
import { logoutUser, initUser } from "../utils/user";
import { generateRecoveryCodes, storeRecoveryCodes } from "../utils/recoveryCode";
import { RecoveryCodesDisplay } from "../components/RecoveryCodesDisplay";
import { supabase } from "../utils/supabase";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
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
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
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
    finally { setLoading(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { setPasswordError("Min 6 characters."); return; }
    setLoading(true);
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
    finally { setLoading(false); }
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>PREFERENCES</Text>
          <SettingsItem icon={<BarChart2 size={20} color={theme.colors.textSecondary} />} title="Polls & Features" onPress={() => router.push("/polls")} />
          <SettingsItem icon={<Bell size={20} color={notificationsEnabled ? theme.colors.success : theme.colors.textSecondary} />} title="Notifications" onPress={() => setNotificationsEnabled(!notificationsEnabled)} />
        </View>

        {auth?.password && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>SECURITY</Text>
            <SettingsItem icon={<Key size={20} color={theme.colors.textSecondary} />} title="Change Password" onPress={() => { setShowChangePassword(true); setPasswordError(""); }} />
            <SettingsItem icon={<Shield size={20} color={theme.colors.textSecondary} />} title="Recovery Codes" onPress={handleRegenerateRecoveryCodes} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>LEGAL</Text>
          <SettingsItem icon={<Shield size={20} color={theme.colors.textSecondary} />} title="Privacy Policy" onPress={() => {}} />
          <SettingsItem icon={<Info size={20} color={theme.colors.textSecondary} />} title="Guidelines" onPress={() => {}} />
        </View>

        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <LogOut size={20} color={theme.colors.error} />
          <Text style={[styles.signOutText, { color: theme.colors.error }]}>SIGN OUT</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: theme.colors.textSecondary }]}>TOWN WALL v1.0.5</Text>
      </ScrollView>

      <Modal visible={showPasswordModal || showChangePassword} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{showChangePassword ? "New Password" : "Confirm Identity"}</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              placeholder={showChangePassword ? "Enter new password" : "Enter current password"}
              value={showChangePassword ? newPassword : currentPassword}
              onChangeText={showChangePassword ? setNewPassword : setCurrentPassword}
              secureTextEntry
              autoFocus
            />
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            <TouchableOpacity 
              style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}
              onPress={showChangePassword ? handleChangePassword : handlePasswordConfirm}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalBtnText}>{showChangePassword ? "UPDATE" : "CONFIRM"}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowPasswordModal(false); setShowChangePassword(false); }} style={styles.closeBtn}>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: '700' }}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showRecoveryCodes} animationType="fade">
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <Text style={[styles.headerTitle, { color: theme.colors.text, flex: 1, textAlign: 'center' }]}>New Recovery Codes</Text>
          </View>
          <RecoveryCodesDisplay codes={newRecoveryCodes} onConfirm={() => setShowRecoveryCodes(false)} isRegeneration />
        </View>
      </Modal>
    </View>
  );
}

function SettingsItem({ icon, title, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.item, { borderBottomColor: theme.colors.border }]}>
      <View style={styles.itemLeft}>
        {icon}
        <Text style={[styles.itemTitle, { color: theme.colors.text }]}>{title}</Text>
      </View>
      <ChevronRight size={18} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  section: { marginTop: 20 },
  sectionLabel: { fontSize: 12, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  itemTitle: { fontSize: 16 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: 20, paddingVertical: 20, marginTop: 20 },
  signOutText: { fontSize: 16, fontWeight: 'bold' },
  version: { textAlign: 'center', fontSize: 12, marginTop: 40, opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', borderRadius: 20, padding: 20, borderWidth: 1, gap: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  modalInput: { borderRadius: 10, padding: 15, fontSize: 16, borderWidth: 1 },
  modalBtn: { padding: 15, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { color: '#FFF', fontWeight: 'bold' },
  closeBtn: { alignItems: 'center', padding: 10 },
  errorText: { color: '#ef4444', fontSize: 12, textAlign: 'center' },
});
