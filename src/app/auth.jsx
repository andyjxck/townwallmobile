import * as Crypto from 'expo-crypto';
import { useState, useEffect } from "react";
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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../utils/supabase";
import { useAuthStore } from "../utils/auth";
import { getDeviceId } from "../utils/deviceId";
import { initUser } from "../utils/user";
import { ChevronLeft, User, Lock } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import bcrypt from 'bcryptjs';
import { generateRecoveryCodes, storeRecoveryCodes } from "../utils/recoveryCode";
import RecoveryCodesDisplay from "../components/RecoveryCodesDisplay";
import { theme } from "../utils/theme";
import { useTheme } from "@/utils/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

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

export default function Auth() {
  const { isHippie } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [isLogin, setIsLogin] = useState(params.mode === "login");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [pendingUser, setPendingUser] = useState(null);

  useEffect(() => {
    if (params.mode === "login") {
      setIsLogin(true);
    } else if (params.mode === "signup") {
      setIsLogin(false);
    }
  }, [params.mode]);

  const handleRecoveryCodesConfirmed = async () => {
    if (pendingUser) {
      useAuthStore.getState().setAuth(pendingUser);
      await initUser();
      router.replace("/");
    }
  };

  const handleAuth = async () => {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const deviceId = await getDeviceId();

      if (isLogin) {
        const { data: user, error } = await supabase
          .from('rusers')
          .select('*')
          .ilike('username', trimmedUsername)
          .single();

        if (error || !user) {
          throw new Error("Invalid username or password");
        }

        const isMatch = bcrypt.compareSync(trimmedPassword, user.password);
        if (!isMatch) {
          throw new Error("Invalid username or password");
        }

        await supabase
          .from('rusers')
          .update({ device_id: deviceId })
          .eq('id', user.id);

        useAuthStore.getState().setAuth(user);
        await initUser();
        router.replace("/");
      } else {
        const { data: existingUser } = await supabase
          .from('rusers')
          .select('id')
          .ilike('username', trimmedUsername)
          .single();

        if (existingUser) {
          throw new Error("Username is already taken");
        }

        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(trimmedPassword, salt);

        const { auth: currentAuth } = useAuthStore.getState();
        
        let newUser;
        if (currentAuth && !currentAuth.password) {
          const { data: updatedUser, error: updateError } = await supabase
            .from('rusers')
            .update({ 
              username: trimmedUsername,
              password: hashedPassword
            })
            .eq('id', currentAuth.id)
            .select()
            .single();
          
          if (updateError) throw updateError;
          newUser = updatedUser;
        } else {
          const { data: createdUser, error: createError } = await supabase
            .from('rusers')
            .insert({ 
              username: trimmedUsername,
              password: hashedPassword,
              device_id: deviceId,
              emoji_icon: '👤'
            })
            .select()
            .single();
          
          if (createError) throw createError;
          newUser = createdUser;
        }
      
        const codes = generateRecoveryCodes();
        await storeRecoveryCodes(newUser.id, codes);
        
        setPendingUser(newUser);
        setRecoveryCodes(codes);
        setShowRecoveryCodes(true);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (showRecoveryCodes) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Recovery Codes</Text>
        </View>
        <RecoveryCodesDisplay 
          codes={recoveryCodes}
          onConfirm={handleRecoveryCodesConfirmed}
        />
      </View>
    );
  }

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
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
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
            <Text style={styles.title}>{isLogin ? "Welcome Back" : "Join Town Wall"}</Text>
            <Text style={styles.subtitle}>
              {isLogin 
                ? "Sign in to continue sharing with your community" 
                : "Create an account to start posting and interacting locally"}
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
              <Lock size={20} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isLogin ? "Sign In" : "Create Account"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsLogin(!isLogin);
              }}
            >
              <Text style={styles.secondaryButtonText}>
                {isLogin ? "Need an account? Sign Up" : "Already have an account? Sign In"}
              </Text>
            </TouchableOpacity>

            {isLogin && (
              <TouchableOpacity 
                style={styles.forgotPassword} 
                onPress={() => router.push("/forgot-password")}
              >
                <Text style={styles.forgotPasswordText}>Forgotten your password?</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Town Wall is private by design. We never ask for your email or phone number.
          </Text>
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
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
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
  forgotPassword: {
    alignItems: "center",
    marginTop: -8,
  },
  forgotPasswordText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    marginTop: 40,
    alignItems: "center",
  },
  footerText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 20,
  }
});
