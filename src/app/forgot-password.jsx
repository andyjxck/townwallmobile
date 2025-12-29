import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, User, Key } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import bcrypt from 'bcryptjs';
import * as Crypto from 'expo-crypto';
import { theme } from "../utils/theme";
import { useTheme } from "@/utils/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { verifyRecoveryCode } from '../utils/recoveryCode';

// Set random fallback for bcryptjs
bcrypt.setRandomFallback((len) => {
  const bytes = Crypto.getRandomBytes(len);
  return Array.from(bytes);
});

export default function ForgotPassword() {
  const { isHippie } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  const handleRecover = async () => {
    const trimmedUsername = username.trim();
    const trimmedCode = recoveryCode.trim();

    if (!trimmedUsername || !trimmedCode) {
      Alert.alert("Error", "Please enter both your username and recovery code");
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await verifyRecoveryCode(trimmedUsername, trimmedCode);

      if (result.success) {
        useAuthStore.getState().setAuth(result.user);
        await initUser();
        Alert.alert(
          "Success", 
          "Account recovered successfully! Please update your password in settings.",
          [{ text: "OK", onPress: () => router.replace("/") }]
        );
      } else {
        Alert.alert("Error", result.message || "Invalid username or recovery code");
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, isHippie && { backgroundColor: 'transparent' }]}
    >
      <StatusBar style="light" />
      {!isHippie && (
        <LinearGradient
          colors={['#0F172A', '#000000']}
          style={StyleSheet.absoluteFill}
        />
      )}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeft color="#FFFFFF" size={28} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>Account Recovery</Text>
            <Text style={styles.subtitle}>
              Enter your username and one of your 8-digit recovery codes to sign back into your account.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <User size={20} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Key size={20} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Recovery Code (e.g. ABCDEFGH)"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={recoveryCode}
                onChangeText={setRecoveryCode}
                autoCapitalize="characters"
                maxLength={8}
              />
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRecover}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.back()}
            >
              <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  content: {
    flex: 1,
  },
  titleSection: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 24,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 60,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  primaryButton: {
    backgroundColor: "#FFFFFF",
    height: 60,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#000000",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#4ADE80",
    fontSize: 15,
    fontWeight: "600",
  },
});
