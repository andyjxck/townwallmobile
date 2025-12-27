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
import { ChevronLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import bcrypt from 'bcryptjs';
import { generateRecoveryCodes, storeRecoveryCodes } from "../utils/recoveryCode";
import { RecoveryCodesDisplay } from "../components/RecoveryCodesDisplay";
import { theme } from "../utils/theme";

export default function Auth() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
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
      <View style={styles.container}>
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
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeft color={theme.colors.text} size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isLogin ? "Sign In" : "Sign Up"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.form}>
        <Text style={styles.title}>{isLogin ? "Welcome Back" : "Join TownWall"}</Text>
        <Text style={styles.subtitle}>
          {isLogin 
            ? "Enter your credentials to continue" 
            : "Create an account to start posting and interacting"}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {isLogin ? "Sign In" : "Create Account"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toggle} 
          onPress={() => setIsLogin(!isLogin)}
        >
          <Text style={styles.toggleText}>
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
  },
  form: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 30,
  },
  input: {
    backgroundColor: theme.colors.surface,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  toggle: {
    marginTop: 20,
    alignItems: "center",
  },
  toggleText: {
    color: theme.colors.primary,
    fontSize: 16,
  },
  forgotPassword: {
    marginTop: 15,
    alignItems: "center",
  },
  forgotPasswordText: {
    color: theme.colors.secondary,
    fontSize: 14,
  },
});
