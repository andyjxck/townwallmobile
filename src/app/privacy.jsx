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
          
          <Text style={[styles.title, { color: theme.colors.text }]}>Privacy Policy & Terms of Service</Text>
          
          <Section title="1. Overview">
            This Privacy Policy ("Policy") describes how our application ("we," "us," or "the Service") handles information. By using the Service, you agree to the terms outlined herein. We prioritize user pseudonymity and data minimization.
          </Section>

          <Section title="2. Data Minimization & Collection">
            We are committed to absolute privacy. The Service does NOT collect or store:
            {"\n"}• Legal Names or Physical Addresses
            {"\n"}• Email Addresses or Phone Numbers
            {"\n"}• Biometric Data or Government IDs
            {"\n"}• Precise Geolocation Data
            {"\n\n"}
            The only data required for account creation is a unique Username and a hashed Password. This information is used solely for authentication purposes.
          </Section>

          <Section title="3. User-Generated Content">
            Any content you voluntarily share—including posts, comments, images, or profile metadata—is public by design. While we offer "anonymous" posting options, this merely removes the public link to your username; it does not change the nature of the data stored in our database. You are solely responsible for the content you upload and any consequences resulting from its publication.
          </Section>

          <Section title="4. Third-Party Infrastructure">
            We utilize industry-leading third-party providers to facilitate the Service:
            {"\n"}• <Text style={{ fontWeight: 'bold' }}>Database & Auth:</Text> Powered by Supabase. Your credentials and content reside on their secure infrastructure.
            {"\n"}• <Text style={{ fontWeight: 'bold' }}>Payments:</Text> Managed via RevenueCat and Stripe. We do not process or store your credit card information directly.
            {"\n\n"}
            While we choose partners with high security standards, we are not responsible for the privacy practices or security of these third-party entities.
          </Section>

          <Section title="5. Data Security & "Recovery Codes"">
            Passwords are cryptographically hashed using standard protocols. We cannot recover forgotten passwords. It is your exclusive responsibility to manage your credentials and secure your Recovery Codes. Loss of these credentials may result in permanent loss of access to your account and associated data.
          </Section>

          <Section title="6. Service Provision "As-Is"">
            The Service is provided on an "AS IS" and "AS AVAILABLE" basis. We make no warranties, express or implied, regarding the reliability, availability, or accuracy of the Service. We reserve the right to modify, suspend, or terminate any aspect of the Service at any time without prior notice or liability.
          </Section>

          <Section title="7. Limitation of Liability">
            To the maximum extent permitted by law, the developer(s) and operator(s) of this Service shall not be liable for any direct, indirect, incidental, special, or consequential damages, including but not limited to loss of profits, data, or goodwill, arising out of your use or inability to use the Service, even if advised of the possibility of such damages.
          </Section>

          <Section title="8. Indemnification">
            You agree to indemnify and hold harmless the developer(s) and affiliates from any claims, losses, or demands (including legal fees) made by any third party due to or arising out of your breach of this Policy or your violation of any law or the rights of a third party.
          </Section>

          <Section title="9. Modifications to this Policy">
            We may update this Policy periodically. Continued use of the Service following any changes constitutes your acceptance of the revised terms.
          </Section>

          <Text style={[styles.footer, { color: theme.colors.textSecondary }]}>
            Last updated: December 27, 2025
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