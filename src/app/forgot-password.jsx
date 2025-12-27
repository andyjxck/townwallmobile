import { useState } from "react";
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
import { useRouter } from "expo-router";
import { ChevronLeft, AlertCircle, Lock, RefreshCw } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { 
  validateRecoveryCode, 
  resetPassword, 
  regenerateCodesAfterExhaustion,
  getUnusedCodeCount 
} from "@/utils/recoveryCode";
import { RecoveryCodesDisplay } from "@/components/RecoveryCodesDisplay";
import { useAuthStore } from "@/utils/auth";
import { getDeviceId } from "@/utils/deviceId";
import { supabase } from "@/utils/supabase";

const STEPS = {
  ENTER_USERNAME: 1,
  ENTER_CODE: 2,
  NEW_PASSWORD: 3,
  REGENERATE_CODES: 4,
  SUCCESS: 5,
};

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState(STEPS.ENTER_USERNAME);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [validatedUserId, setValidatedUserId] = useState(null);
  const [needsRegeneration, setNeedsRegeneration] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState([]);
  const [remainingCodes, setRemainingCodes] = useState(0);

  const clearError = () => setErrorMessage("");

  const handleUsernameSubmit = () => {
    if (!username.trim()) {
      setErrorMessage("Please enter your username");
      return;
    }
    clearError();
    setStep(STEPS.ENTER_CODE);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCodeSubmit = async () => {
    if (!recoveryCode.trim()) {
      setErrorMessage("Please enter a recovery code");
      return;
    }

    setLoading(true);
    clearError();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await validateRecoveryCode(username, recoveryCode);

      if (!result.valid) {
        if (result.reason === 'locked') {
          setErrorMessage(`Too many attempts. Please try again in ${result.minutesLeft} minutes.`);
        } else {
          setErrorMessage("Invalid username or recovery code");
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      setValidatedUserId(result.userId);
      setRemainingCodes(result.remainingCodes);
      setNeedsRegeneration(result.needsRegeneration);
      setStep(STEPS.NEW_PASSWORD);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!newPassword || !confirmPassword) {
      setErrorMessage("Please fill in both password fields");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    setLoading(true);
    clearError();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await resetPassword(validatedUserId, newPassword);

      if (needsRegeneration) {
        const codes = await regenerateCodesAfterExhaustion(validatedUserId);
        setNewRecoveryCodes(codes);
        setStep(STEPS.REGENERATE_CODES);
      } else {
        setStep(STEPS.SUCCESS);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setErrorMessage("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerationConfirmed = async () => {
    const deviceId = await getDeviceId();
    const { data: user } = await supabase
      .from('rusers')
      .select('*')
      .eq('id', validatedUserId)
      .single();

    if (user) {
      await supabase
        .from('rusers')
        .update({ device_id: deviceId })
        .eq('id', user.id);
      
      useAuthStore.getState().setAuth(user);
    }
    
    router.replace("/profile");
  };

  const handleSuccessContinue = async () => {
    const deviceId = await getDeviceId();
    const { data: user } = await supabase
      .from('rusers')
      .select('*')
      .eq('id', validatedUserId)
      .single();

    if (user) {
      await supabase
        .from('rusers')
        .update({ device_id: deviceId })
        .eq('id', user.id);
      
      useAuthStore.getState().setAuth(user);
    }
    
    router.replace("/profile");
  };

  const renderStep = () => {
    switch (step) {
      case STEPS.ENTER_USERNAME:
        return (
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Lock size={48} color="#3B82F6" />
            </View>
            <Text style={styles.title}>Forgotten your password?</Text>
            <Text style={styles.description}>
              Enter your username below. You'll need one of your recovery codes to reset your password.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  clearError();
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color="#EF4444" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.button} onPress={handleUsernameSubmit}>
              <Text style={styles.buttonText}>CONTINUE</Text>
            </TouchableOpacity>
          </View>
        );

      case STEPS.ENTER_CODE:
        return (
          <View style={styles.content}>
            <Text style={styles.title}>Enter Recovery Code</Text>
            <Text style={styles.description}>
              Enter one of your unused recovery codes. This code will be marked as used after successful verification.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Recovery Code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="XXXX-XXXX-XXXX"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={recoveryCode}
                onChangeText={(text) => {
                  setRecoveryCode(text.toUpperCase());
                  clearError();
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color="#EF4444" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <TouchableOpacity 
              style={styles.button} 
              onPress={handleCodeSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.buttonText}>VERIFY CODE</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => {
                setStep(STEPS.ENTER_USERNAME);
                clearError();
              }}
            >
              <Text style={styles.backButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
        );

      case STEPS.NEW_PASSWORD:
        return (
          <View style={styles.content}>
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.description}>
              Create a strong password for your account.
            </Text>

            {remainingCodes > 0 && remainingCodes <= 3 && (
              <View style={styles.warningBox}>
                <AlertCircle size={16} color="#F59E0B" />
                <Text style={styles.warningText}>
                  You have {remainingCodes} recovery code{remainingCodes !== 1 ? 's' : ''} remaining.
                </Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  clearError();
                }}
                secureTextEntry
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  clearError();
                }}
                secureTextEntry
              />
            </View>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color="#EF4444" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <TouchableOpacity 
              style={styles.button} 
              onPress={handlePasswordReset}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.buttonText}>RESET PASSWORD</Text>
              )}
            </TouchableOpacity>
          </View>
        );

      case STEPS.REGENERATE_CODES:
        return (
          <>
            <View style={styles.regenerateHeader}>
              <RefreshCw size={24} color="#F59E0B" />
              <Text style={styles.regenerateTitle}>New Recovery Codes Required</Text>
            </View>
            <Text style={styles.regenerateDescription}>
              You've used all your recovery codes. New codes have been generated. Save them now - this is your only chance!
            </Text>
            <RecoveryCodesDisplay 
              codes={newRecoveryCodes}
              onConfirm={handleRegenerationConfirmed}
              isRegeneration={true}
            />
          </>
        );

      case STEPS.SUCCESS:
        return (
          <View style={styles.content}>
            <View style={[styles.iconContainer, styles.successIcon]}>
              <Lock size={48} color="#4ADE80" />
            </View>
            <Text style={styles.title}>Password Reset!</Text>
            <Text style={styles.description}>
              Your password has been successfully reset. You can now sign in with your new password.
            </Text>

            {remainingCodes > 0 && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  You have {remainingCodes} recovery code{remainingCodes !== 1 ? 's' : ''} remaining.
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={handleSuccessContinue}>
              <Text style={styles.buttonText}>CONTINUE TO PROFILE</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.header}>
        {step !== STEPS.REGENERATE_CODES && step !== STEPS.SUCCESS ? (
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft color="#FFFFFF" size={28} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
        <Text style={styles.headerTitle}>
          {step === STEPS.REGENERATE_CODES ? 'Save New Codes' : 'Account Recovery'}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {renderStep()}
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
    paddingTop: 20,
  },
  iconContainer: {
    alignSelf: 'center',
    marginBottom: 24,
    padding: 20,
    borderRadius: 50,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  successIcon: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
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
  codeInput: {
    fontFamily: 'monospace',
    fontSize: 18,
    letterSpacing: 2,
    textAlign: 'center',
  },
  button: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
  backButton: {
    marginTop: 20,
    alignItems: "center",
  },
  backButtonText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    flex: 1,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  warningText: {
    color: '#F59E0B',
    fontSize: 13,
  },
  infoBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    color: '#3B82F6',
    fontSize: 14,
    textAlign: 'center',
  },
  regenerateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  regenerateTitle: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: '700',
  },
  regenerateDescription: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
});
