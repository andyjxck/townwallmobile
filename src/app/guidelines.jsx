import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/utils/theme';

export default function Guidelines() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Community Guidelines</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Info size={64} color={theme.colors.primary} />
        </View>
        
        <Text style={[styles.title, { color: theme.colors.text }]}>The Rules of the Wall</Text>
        
        <Section title="1. Be Helpful">
          The Wall is a community resource. Aim to provide value, whether it's news, advice, or support for local businesses and talent.
        </Section>

        <Section title="2. No Harassment">
          We have zero tolerance for bullying, harassment, or hate speech. Content that targets individuals or groups will be removed.
        </Section>

        <Section title="3. Local Focus">
          Keep it relevant to your local area and the community zones.
        </Section>

        <Section title="4. Misinformation">
          Deliberately posting false news ("Fake News") will result in content being blurred or removed. Users can flag content they believe is incorrect.
        </Section>

        <Section title="5. Moderation">
          Our MOD team and AI filters monitor the Wall. If your content is flagged, it may be held for review.
        </Section>

        <Text style={[styles.footer, { color: theme.colors.textSecondary }]}>
          Help us keep the Wall a great place for everyone.
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
  footer: { textAlign: 'center', marginTop: 20, marginBottom: 40, fontSize: 14, fontStyle: 'italic' },
});