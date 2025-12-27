import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Copy, Download, CheckCircle } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { theme } from '../utils/theme';

export function RecoveryCodesDisplay({ codes, onConfirm }) {
  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(codes.join('\n'));
    Alert.alert("Copied", "Recovery codes copied to clipboard");
  };

  const downloadCodes = async () => {
    const fileUri = `${FileSystem.documentDirectory}recovery_codes.txt`;
    await FileSystem.writeAsStringAsync(fileUri, codes.join('\n'));
    await Sharing.shareAsync(fileUri);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.description}>
        Please save these recovery codes in a safe place. You can use them to access your account if you lose your password.
      </Text>
      
      <ScrollView style={styles.codesContainer}>
        {codes.map((code, index) => (
          <View key={index} style={styles.codeItem}>
            <Text style={styles.codeText}>{code}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={copyToClipboard}>
          <Copy size={20} color={theme.colors.primary} />
          <Text style={styles.actionText}>Copy All</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={downloadCodes}>
          <Download size={20} color={theme.colors.primary} />
          <Text style={styles.actionText}>Download</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
        <CheckCircle size={24} color="#FFFFFF" />
        <Text style={styles.confirmButtonText}>I've saved these codes</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    maxHeight: 300,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  codeItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
  },
  codeText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    marginBottom: 30,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  actionText: {
    marginLeft: 8,
    color: theme.colors.primary,
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
  },
});
