import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, MessageCircle, Calendar, ShieldCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TalkToCouncillor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#FFFFFF" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>TALK TO A COUNCILLOR</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.comingSoonBox}>
          <Text style={styles.comingSoonTitle}>COMING SOON</Text>
          <Text style={styles.comingSoonText}>
            We're working hard to find willing local councillors to join our platform.
          </Text>
          <Text style={styles.comingSoonText}>
            Soon, you'll be able to directly message a local representative for help in dire times.
          </Text>
        </View>

        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <MessageCircle size={24} color="#60A5FA" />
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Direct Messaging</Text>
              <Text style={styles.featureDesc}>Secure 1-to-1 chat with your local representative.</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Calendar size={24} color="#FBBF24" />
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Surgery Bookings</Text>
              <Text style={styles.featureDesc}>Book slots for face-to-face local surgeries.</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <ShieldCheck size={24} color="#34D399" />
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Verified Status</Text>
              <Text style={styles.featureDesc}>Only officially verified councillors can participate.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  backButton: {
    padding: 5,
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  comingSoonBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 30,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  comingSoonTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 15,
    letterSpacing: 2,
  },
  comingSoonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
  },
  featureList: {
    width: '100%',
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 20,
    borderRadius: 15,
    gap: 15,
    alignItems: 'center',
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDesc: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
});
