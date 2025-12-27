import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/utils/theme';

export default function PrivacyPolicy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Privacy Policy</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Shield size={64} color={theme.colors.primary} />
        </View>
        
        <Text style={[styles.title, { color: theme.colors.text }]}>Your Privacy Matters</Text>
        
        <Section title="Data Collection">
          We believe in absolute privacy. We do NOT collect:
          {"\n"}• Your Email Address
          {"\n"}• Your Phone Number
          {"\n"}• Your Physical Address
          {"\n"}• Your Date of Birth
          {"\n"}• Your Real Name
          {"\n\n"}
          We only require a Username and Password to create your account.
        </Section>

        <Section title="Authentication">
          Your password is encrypted using industry-standard hashing before being stored. We cannot see your password.
        </Section>

        <Section title="Content">
          Any posts, comments, or interactions you make on the Wall are visible to other users. You can choose to post anonymously, in which case your username will not be attached to the content.
        </Section>

        <Section title="Cookies & Tracking">
          We do not use tracking cookies or third-party analytics that identify you personally.
        </Section>

        <Text style={[styles.footer, { color: theme.colors.textSecondary }]}>
          Last updated: December 2025
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.sectionText, { color: theme.colors.textSecondary }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  backBtn: { padding: 8 },
  content: { padding: 20 },
  iconContainer: { alignItems: 'center', marginVertical: 30 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  sectionText: { fontSize: 16, lineHeight: 24 },
  footer: { textAlign: 'center', marginTop: 20, marginBottom: 40, fontSize: 12 },
});