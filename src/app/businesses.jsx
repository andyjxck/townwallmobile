import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Briefcase, Globe, Phone, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/utils/supabase';
import { getStoredUser } from '@/utils/user';
import * as Haptics from 'expo-haptics';

export default function LocalBusinesses() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: '',
    website: '',
    phone: '',
    description: ''
  });

  const handleSubmit = async () => {
    if (!form.name || !form.category) {
      Alert.alert("Required", "Please fill in the business name and category.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    
    Alert.alert(
      "Payment Required",
      "This costs £3.99 to showcase your business. Proceed to mock payment?",
      [
        { text: "Cancel", onPress: () => setLoading(false), style: "cancel" },
        { text: "Pay £3.99", onPress: async () => {
          try {
            const user = await getStoredUser();
            const { error } = await supabase
              .from('rbusinesses')
              .insert({
                user_id: user?.id,
                name: form.name,
                category: form.category,
                website: form.website,
                phone: form.phone,
                description: form.description,
                payment_status: 'paid'
              });

            if (error) throw error;
            
            Alert.alert("Success!", "Your business has been submitted and will be showcased.");
            router.back();
          } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to save business details.");
          } finally {
            setLoading(false);
          }
        }}
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#FFFFFF" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LOCAL BUSINESSES</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoBox}>
          <Info size={20} color="#60A5FA" />
          <Text style={styles.infoText}>
            Promote your local business to the community for just £3.99.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>BUSINESS NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Redditch Coffee Co."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={form.name}
            onChangeText={(t) => setForm({ ...form, name: t })}
          />

          <Text style={styles.label}>CATEGORY</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Cafe / Restaurant / Retail"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={form.category}
            onChangeText={(t) => setForm({ ...form, category: t })}
          />

          <Text style={styles.label}>WEBSITE (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="https://..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            value={form.website}
            onChangeText={(t) => setForm({ ...form, website: t })}
          />

          <Text style={styles.label}>PHONE NUMBER (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="01234 567890"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(t) => setForm({ ...form, phone: t })}
          />

          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your business and any special offers..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            numberOfLines={4}
            value={form.description}
            onChangeText={(t) => setForm({ ...form, description: t })}
          />

          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.submitButtonText}>PAY £3.99 & SUBMIT</Text>
            )}
          </TouchableOpacity>
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
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  backButton: {
    padding: 5,
  },
  scrollContent: {
    padding: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    padding: 15,
    borderRadius: 12,
    gap: 12,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  infoText: {
    color: '#60A5FA',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  form: {
    gap: 15,
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 15,
    color: '#FFFFFF',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
  },
});
