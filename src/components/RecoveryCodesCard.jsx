import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export const RecoveryCodesCard = ({ codes }) => {
  if (!codes || !Array.isArray(codes)) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#111111', '#000000']}
        style={styles.card}
      >
        <View style={styles.header}>
          <View style={styles.brandContainer}>
            <Shield size={24} color="#FFFFFF" />
            <Text style={styles.appTitle}>RECOVERY CODES</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>SECURE</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Keep these safe!</Text>
          <Text style={styles.subtitle}>
            Use these codes to access your account if you lose your password. 
            Each code can only be used once.
          </Text>
          
          <View style={styles.codesGrid}>
            {codes.map((code, index) => (
              <View key={index} style={styles.codeWrapper}>
                <Text style={styles.indexText}>#{index + 1}</Text>
                <Text style={styles.codeText}>{code}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.branding}>TOWN WALL SECURITY</Text>
          <Text style={styles.date}>Generated on {new Date().toLocaleDateString()}</Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width,
    padding: 2,
    backgroundColor: '#222',
  },
  card: {
    padding: 32,
    minHeight: width * 1.4,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#FFFFFF',
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
    marginBottom: 32,
  },
  codesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  codeWrapper: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  indexText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.3)',
    width: 24,
  },
  codeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  branding: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '800',
    letterSpacing: 1,
  },
  date: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
  },
});
