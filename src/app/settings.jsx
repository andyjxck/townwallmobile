import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, TextInput, Modal, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, LogOut, Shield, Info, Bell, Key, BarChart2, ChevronRight } from "lucide-react-native";
import { theme } from "../utils/theme";
import { useTheme } from "@/utils/ThemeContext";
import { useAuth } from "../utils/auth/useAuth";
import { useAuthStore } from "../utils/auth";
import * as Haptics from "expo-haptics";
import bcrypt from 'bcryptjs';
import * as Crypto from 'expo-crypto';
import { supabase } from "../utils/supabase";
import { generateRecoveryCodes, storeRecoveryCodes, getRecoveryCodesStatus } from "../utils/recoveryCode";
import RecoveryCodesDisplay from "../components/RecoveryCodesDisplay";

// Polyfill for bcryptjs in React Native/Expo
if (typeof global.crypto !== 'object') {
  global.crypto = {};
}
if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = (array) => {
    const randomBytes = Crypto.getRandomBytes(array.length);
    for (let i = 0; i < array.length; i++) {
      array[i] = randomBytes[i];
    }
    return array;
  };
}

export default function SettingsScreen() {
  const { isHippie } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const { auth } = useAuthStore();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRecoveryCodes, setNewRecoveryCodes] = useState([]);
  const [recoveryStatus, setRecoveryStatus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasPasswordLocal, setHasPasswordLocal] = useState(!!auth?.password);
  const [passwordError, setPasswordError] = useState("");

    const loadingMessages = [
      "Generating your secure recovery codes...",
      "I know this can take a while.. I promise it's working!",
      "Almost there... securing your account...",
      "Encryption in progress...",
      "Hashing codes for maximum safety...",
      "One-time use, lifetime security...",
      "Double checking the locks...",
      "Your account's safety is our priority...",
      "Wrapping things up for you...",
      "Finalizing your vault...",
    ];
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 2500);
    } else {
      setLoadingMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    setHasPasswordLocal(!!auth?.password);
  }, [auth?.password]);

  useEffect(() => {
    const checkPassword = async () => {
      if (!auth?.password && auth?.id) {
        const { data } = await supabase.from('rusers').select('password').eq('id', auth.id).single();
        if (data?.password) {
          setHasPasswordLocal(true);
          useAuthStore.getState().setAuth({ ...auth, password: data.password });
        }
      }
    };
    checkPassword();
  }, []);

  const fetchRecoveryStatus = async () => {
    if (!auth?.id) return;
    try {
      const data = await getRecoveryCodesStatus(auth.id);
      setRecoveryStatus(data);
    } catch (error) {
      console.error("Error fetching recovery status:", error);
    }
  };

    const handleOpenRecoveryStatus = async () => {
      let hasPassword = !!auth?.password;
      
      // If password not in store, double check DB to be absolutely sure
      if (!hasPassword && auth?.id) {
        setLoading(true);
        const { data } = await supabase.from('rusers').select('password').eq('id', auth.id).single();
        if (data?.password) {
          hasPassword = true;
          // Sync store if we found it
          useAuthStore.getState().setAuth({ ...auth, password: data.password });
        }
        setLoading(false);
      }

      if (!hasPassword) {
      Alert.alert(
        "Password Required", 
        "To use recovery codes, you first need to set a password for your account. This helps keep your account secure!",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Set Password", onPress: () => { setShowChangePassword(true); setPasswordError(""); } }
        ]
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchRecoveryStatus();
    setShowStatusModal(true);
  };

  const handleRegenerateRecoveryCodes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowStatusModal(false);
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
      const { data: user, error: userError } = await supabase.from('rusers').select('password').eq('id', auth.id).single();
      if (userError || !user) {
        setPasswordError("Incorrect password or user not found");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (!bcrypt.compareSync(currentPassword, user.password)) {
        setPasswordError("Incorrect password");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      const codes = generateRecoveryCodes();
      // Delete old codes before storing new ones
      await supabase.from('recovery_codes').delete().eq('user_id', auth.id);
      await storeRecoveryCodes(auth.id, codes);
      
      setNewRecoveryCodes(codes);
      setShowPasswordModal(false);
      setShowRecoveryCodes(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) { 
      console.error("Recovery generation error:", error);
      setPasswordError(error.message || "Something went wrong."); 
    }
    finally { setLoading(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { setPasswordError("Min 6 characters."); return; }
    setLoading(true);
    setPasswordError("");
    try {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(newPassword, salt);
      const { data, error } = await supabase.from('rusers').update({ password: hashedPassword }).eq('id', auth.id).select().single();
      if (error) throw error;
      
      // Update global store so UI re-renders correctly
      useAuthStore.getState().setAuth(data);
      
      Alert.alert("Success", "Password updated successfully.");
      setShowChangePassword(false);
      setNewPassword("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) { setPasswordError("Failed to update password."); }
    finally { setLoading(false); }
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
        await signOut();
        router.replace("/");
      }}
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: isHippie ? 'transparent' : theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>SECURITY</Text>
                <SettingsItem icon={<Key size={20} color={theme.colors.textSecondary} />} title={hasPasswordLocal ? "Change Password" : "Set Account Password"} onPress={() => { setShowChangePassword(true); setPasswordError(""); }} />
                <SettingsItem icon={<Shield size={20} color={theme.colors.textSecondary} />} title="Recovery Codes" onPress={handleOpenRecoveryStatus} />
              </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>LEGAL</Text>
            <SettingsItem icon={<Shield size={20} color={theme.colors.textSecondary} />} title="Privacy Policy" onPress={() => router.push("/privacy")} />
            <SettingsItem icon={<Info size={20} color={theme.colors.textSecondary} />} title="Guidelines" onPress={() => router.push("/guidelines")} />
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
                    {loading ? (
                      <View style={{ alignItems: 'center', gap: 10 }}>
                        <ActivityIndicator color="#000000" />
                        <Text style={{ color: '#000000', fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 8 }}>
                          {loadingMessages[loadingMessageIndex]}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.modalBtnText, { color: "#000000" }]}>
                        {showChangePassword ? "UPDATE" : "CONFIRM"}
                      </Text>
                    )}
                  </TouchableOpacity>

            <TouchableOpacity onPress={() => { setShowPasswordModal(false); setShowChangePassword(false); }} style={styles.closeBtn}>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: '700' }}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showStatusModal} animationType="slide">
        <View style={[styles.container, { backgroundColor: isHippie ? 'transparent' : theme.colors.background }]}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => setShowStatusModal(false)} style={styles.backBtn}>
              <ChevronLeft size={28} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.colors.text, flex: 1, textAlign: 'center', marginRight: 44 }]}>Recovery Status</Text>
          </View>
          <RecoveryCodesDisplay 
            statuses={recoveryStatus} 
            onConfirm={() => setShowStatusModal(false)} 
            onRegenerate={handleRegenerateRecoveryCodes}
          />
        </View>
      </Modal>

      <Modal visible={showRecoveryCodes} animationType="fade">
        <View style={[styles.container, { backgroundColor: isHippie ? 'transparent' : theme.colors.background }]}>
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
  modalBtnText: { color: '#000', fontWeight: 'bold' },
  closeBtn: { alignItems: 'center', padding: 10 },
  errorText: { color: '#ef4444', fontSize: 12, textAlign: 'center' },
});
