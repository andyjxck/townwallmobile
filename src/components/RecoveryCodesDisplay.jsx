import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Copy, Download, CheckCircle, RefreshCcw, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { theme } from '../utils/theme';

export default function RecoveryCodesDisplay({ 
  codes, 
  onConfirm, 
  isRegeneration, 
  statuses, 
  onRegenerate 
}) {
  const isViewMode = !!statuses && !codes;

  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = async () => {
    if (!codes) return;
    await Clipboard.setStringAsync(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const downloadCodes = async () => {
    if (!codes) return;
    const fileUri = `${FileSystem.documentDirectory}recovery_codes.txt`;
    await FileSystem.writeAsStringAsync(fileUri, codes.join('\n'));
    await Sharing.shareAsync(fileUri);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.description}>
        {isRegeneration 
          ? "Please save these recovery codes in a safe place. You can use them to access your account if you lose your password."
          : "These codes allow you to access your account if you lose your password. Each code can only be used once."}
      </Text>
      
      <ScrollView style={styles.codesContainer}>
        {isViewMode ? (
          statuses.map((item, index) => (
            <View key={item.id || index} style={styles.codeItem}>
              <Text style={styles.indexText}>#{index + 1}</Text>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: item.used ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)' }
              ]}>
                <Text style={[
                  styles.statusText, 
                  { color: item.used ? theme.colors.error : '#22c55e' }
                ]}>
                  {item.used ? 'USED' : 'AVAILABLE'}
                </Text>
              </View>
            </View>
          ))
        ) : (
          codes.map((code, index) => (
            <View key={index} style={styles.codeItem}>
              <Text style={styles.codeText}>{code}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {isRegeneration && (
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionButton, copied && { backgroundColor: '#22c55e' }]} 
            onPress={copyToClipboard}
          >
            {copied ? <Check size={20} color="#000000" /> : <Copy size={20} color="#000000" />}
            <Text style={styles.actionText}>{copied ? "Copied!" : "Copy All"}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={downloadCodes}>
            <Download size={20} color="#000000" />
            <Text style={styles.actionText}>Download</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isRegeneration && onRegenerate && (
        <TouchableOpacity 
          style={[styles.confirmButton, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12 }]} 
          onPress={onRegenerate}
        >
          <RefreshCcw size={20} color={theme.colors.text} />
          <Text style={[styles.confirmButtonText, { color: theme.colors.text }]}>Regenerate All Codes</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity 
        style={[
          styles.confirmButton, 
          isRegeneration && !copied && { opacity: 0.7 }
        ]} 
        onPress={() => {
          if (isRegeneration && !copied) {
            Alert.alert(
              "Save Codes", 
              "Please copy or download your recovery codes before continuing to ensure you don't lose access to your account.",
              [
                { text: "I'll save them first", style: "cancel" },
                { text: "I've already saved them", onPress: onConfirm }
              ]
            );
          } else {
            onConfirm();
          }
        }}
      >
        <CheckCircle size={24} color="#000000" />
        <Text style={styles.confirmButtonText}>
          {isRegeneration ? "I've saved these codes" : "Close"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: theme.colors.background,
  },
  description: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  codesContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 15,
    maxHeight: 400,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
  },
  codeItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },
  codeText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: 1,
  },
  indexText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    width: 40,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    minWidth: '45%',
    justifyContent: 'center',
  },
  actionText: {
    marginLeft: 8,
    color: '#000000',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
  },
});
