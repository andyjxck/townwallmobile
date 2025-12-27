import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Copy, CheckCircle, AlertTriangle } from 'lucide-react-native';

export function RecoveryCodesDisplay({ codes, onConfirm, isRegeneration = false }) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyAll = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const codesText = codes.join('\n');
    await Clipboard.setStringAsync(codesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (!confirmed) {
      Alert.alert(
        'Have you saved your codes?',
        'These codes will NOT be shown again. Make sure you have saved them somewhere safe.',
        [
          { text: 'Go Back', style: 'cancel' },
          { 
            text: 'Yes, I saved them', 
            onPress: () => {
              setConfirmed(true);
              onConfirm();
            }
          }
        ]
      );
    } else {
      onConfirm();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.warningBox}>
        <AlertTriangle size={24} color="#F59E0B" />
        <Text style={styles.warningText}>
          These recovery codes are the only way to regain access if you forget your password.
          {'\n'}Save them somewhere safe. Anyone with a code can reset your password.
        </Text>
      </View>

      {isRegeneration && (
        <View style={styles.regenerationNotice}>
          <Text style={styles.regenerationText}>
            Your previous recovery codes have been invalidated.
            {'\n'}These are your new codes.
          </Text>
        </View>
      )}

      <ScrollView style={styles.codesContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.codesGrid}>
          {codes.map((code, index) => (
            <View key={index} style={styles.codeItem}>
              <Text style={styles.codeNumber}>{index + 1}.</Text>
              <Text style={styles.codeText}>{code}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.copyButton} onPress={handleCopyAll}>
        {copied ? (
          <>
            <CheckCircle size={20} color="#4ADE80" />
            <Text style={[styles.copyButtonText, { color: '#4ADE80' }]}>Copied!</Text>
          </>
        ) : (
          <>
            <Copy size={20} color="#FFFFFF" />
            <Text style={styles.copyButtonText}>Copy All Codes</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={[styles.checkbox, confirmed && styles.checkboxChecked]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setConfirmed(!confirmed);
          }}
        >
          {confirmed && <CheckCircle size={16} color="#000000" />}
        </TouchableOpacity>
        <Text style={styles.checkboxLabel}>
          I have saved these codes in a secure location
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.confirmButton, !confirmed && styles.confirmButtonDisabled]}
        onPress={handleConfirm}
        disabled={!confirmed}
      >
        <Text style={[styles.confirmButtonText, !confirmed && styles.confirmButtonTextDisabled]}>
          {isRegeneration ? 'CONTINUE' : 'COMPLETE SETUP'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.neverAgainText}>
        These codes will never be shown again after you continue.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  warningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    color: '#F59E0B',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  regenerationNotice: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  regenerationText: {
    color: '#3B82F6',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  codesContainer: {
    flex: 1,
    marginBottom: 20,
  },
  codesGrid: {
    gap: 8,
  },
  codeItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeNumber: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    width: 24,
  },
  codeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4ADE80',
    borderColor: '#4ADE80',
  },
  checkboxLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  confirmButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  confirmButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  confirmButtonTextDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
  neverAgainText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
