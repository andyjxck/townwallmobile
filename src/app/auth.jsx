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
import { supabase } from "@/utils/supabase";
import { useAuthStore } from "@/utils/auth";
import { getDeviceId } from "@/utils/deviceId";
import { initUser } from "@/utils/user";
import { ChevronLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";

export default function Auth() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isLogin, setIsLogin] = useState(params.mode === "login");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (params.mode === "login") {
      setIsLogin(true);
    }
  }, [params.mode]);

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
        // Sign in: Find user with matching username and password
        const { data: user, error } = await supabase
          .from('rusers')
          .select('*')
          .eq('username', username)
          .eq('password', password)
          .single();

        if (error || !user) {
          throw new Error("Invalid username or password");
        }

        // Link this device to the logged-in user
        await supabase
          .from('rusers')
          .update({ device_id: deviceId })
          .eq('id', user.id);

        useAuthStore.getState().setAuth(user);
      } else {
        // Sign up: Check if username is taken
        const { data: existingUser } = await supabase
          .from('rusers')
          .select('id')
          .eq('username', username)
          .single();

        if (existingUser) {
          throw new Error("Username is already taken");
        }

        // Get current anonymous user to upgrade it, or create new
        const { auth: currentAuth } = useAuthStore.getState();
        
        if (currentAuth && !currentAuth.password) {
          // Upgrade current anonymous user
          const { data: updatedUser, error: updateError } = await supabase
            .from('rusers')
            .update({ 
              username: username,
              password: password
            })
            .eq('id', currentAuth.id)
            .select()
            .single();
          
          if (updateError) throw updateError;
          useAuthStore.getState().setAuth(updatedUser);
        } else {
          // Create a new user profile
          const { data: newUser, error: createError } = await supabase
            .from('rusers')
            .insert({ 
              username: username,
              password: password,
              device_id: deviceId,
              emoji_icon: '👤'
            })
            .select()
            .single();
          
          if (createError) throw createError;
          useAuthStore.getState().setAuth(newUser);
        }
      }

      await initUser();
      router.replace("/profile");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft color="#FFFFFF" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isLogin ? "Welcome Back" : "Create Account"}</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          {isLogin 
            ? "Enter your details to sign in." 
            : "Choose a username and password. No email or personal data required."}
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Choose a username"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.buttonText}>{isLogin ? "SIGN IN" : "CREATE ACCOUNT"}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toggle} 
          onPress={() => setIsLogin(!isLogin)}
        >
          <Text style={styles.toggleText}>
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
  },
  description: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 25,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 16,
    color: "#FFFFFF",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  button: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
  toggle: {
    marginTop: 30,
    alignItems: "center",
  },
  toggleText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
});
