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
import { RecoveryCodesDisplay } from "../components/RecoveryCodesDisplay";
import { useTheme } from "../utils/theme";

export default function Auth() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, spacing, borderRadius, typography } = useTheme();
  
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
    }
  }, [params.mode]);

  const handleRecoveryCodesConfirmed = async () => {
    if (pendingUser) {
      useAuthStore.getState().setAuth(pendingUser);
      await initUser();
      router.replace("/profile");
    }
  };

  const handleAuth = async () => {
    if (!username || !password) {
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
          .eq('username', username)
          .single();

        if (error || !user) {
          throw new Error("Invalid username or password");
        }

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) {
          throw new Error("Invalid username or password");
        }

        await supabase
          .from('rusers')
          .update({ device_id: deviceId })
          .eq('id', user.id);

        useAuthStore.getState().setAuth(user);
        await initUser();
        router.replace("/profile");
      } else {
        const { data: existingUser } = await supabase
          .from('rusers')
          .select('id')
          .eq('username', username)
          .single();

        if (existingUser) {
          throw new Error("Username is already taken");
        }

        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);

        const { auth: currentAuth } = useAuthStore.getState();
        
        let newUser;
        if (currentAuth && !currentAuth.password) {
          const { data: updatedUser, error: updateError } = await supabase
            .from('rusers')
            .update({ 
              username: username,
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
              username: username,
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Recovery Codes</Text>
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
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.surface }]}
        >
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text, ...typography.h1 }]}>
            {isLogin ? "Welcome Back" : "Create Account"}
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {isLogin 
              ? "Sign in to join the community." 
              : "Choose a username and password. No personal data required."}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <User size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                placeholder="Username"
                placeholderTextColor={colors.textTertiary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <Lock size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                placeholder="Password"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.primary, borderRadius: borderRadius.xl }]} 
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.buttonText, { ...typography.button }]}>
                {isLogin ? "SIGN IN" : "CREATE ACCOUNT"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.toggle} 
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
              {isLogin ? "New here? " : "Joined already? "}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {isLogin ? "Sign up" : "Sign in"}
              </Text>
            </Text>
          </TouchableOpacity>

          {isLogin && (
            <TouchableOpacity 
              style={styles.forgotPassword} 
              onPress={() => router.push("/forgot-password")}
            >
              <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
                Forgotten your password?
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 20,
  },
  titleContainer: {
    marginBottom: 40,
  },
  title: {
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  input: {
    borderRadius: 16,
    padding: 16,
    paddingLeft: 48,
    fontSize: 16,
    borderWidth: 1,
  },
  button: {
    padding: 20,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: {
    color: "#FFFFFF",
  },
  toggle: {
    marginTop: 24,
    alignItems: "center",
  },
  toggleText: {
    fontSize: 15,
  },
  forgotPassword: {
    marginTop: 16,
    alignItems: "center",
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
