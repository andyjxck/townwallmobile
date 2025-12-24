import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, Image, Platform, FlatList, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Music, Youtube, Globe, Info, Plus, ExternalLink, ShieldCheck, Instagram, CheckCircle2, Star } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/utils/supabase';
import { getStoredUser } from '@/utils/user';
import * as Haptics from 'expo-haptics';
import Purchases from 'react-native-purchases';
import { BlurView } from 'expo-blur';

export default function LocalTalent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [talents, setTalents] = useState([]);
  const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
      name: '',
      title: '',
      platform: 'Youtube',
      link: '',
      description: '',
      category: 'YouTuber'
    });

  useEffect(() => {
    fetchTalents();
    setupRevenueCat();
  }, []);

  const setupRevenueCat = async () => {
    try {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      if (Platform.OS === 'ios') {
        const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
        if (apiKey) {
          await Purchases.configure({ apiKey });
        }
      }
    } catch (e) {
      console.log("RevenueCat Setup Error:", e);
    }
  };

  const fetchTalents = async () => {
    try {
      const { data, error } = await supabase
        .from('rtalent')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTalents(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseAndSubmit = async () => {
    if (!form.name || !form.title || !form.link) {
      Alert.alert("Required", "Please fill in your name, title, and link.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);

    try {
      const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
      
      if (!apiKey) {
        // Fallback for development if no API key is provided yet
        Alert.alert(
          "Development Mode",
          "No RevenueCat API key found. Would you like to proceed with a mock submission?",
          [
            { text: "Cancel", onPress: () => setSubmitting(false), style: "cancel" },
            { text: "Mock Submit", onPress: () => submitTalent('mock_paid') }
          ]
        );
        return;
      }

      const offerings = await Purchases.getOfferings();
      if (offerings.current && offerings.current.availablePackages.length > 0) {
        const pkg = offerings.current.availablePackages[0]; // Assuming first package is the £0.99 one
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        
        if (customerInfo) {
          await submitTalent('paid');
        }
      } else {
        throw new Error("No offerings available. Please check RevenueCat dashboard.");
      }
    } catch (e) {
      if (!e.userCancelled) {
        Alert.alert("Payment Error", e.message || "Something went wrong with the payment.");
      }
      setSubmitting(false);
    }
  };

  const submitTalent = async (paymentStatus) => {
    try {
      const user = await getStoredUser();
      const { error } = await supabase
        .from('rtalent')
        .insert({
          user_id: user?.id,
          name: form.name,
          title: form.title,
          platform: form.platform,
          link: form.link,
          description: form.description,
          category: form.category,
          payment_status: paymentStatus,
          status: 'pending' // Moderation pending
        });

      if (error) throw error;
      
      Alert.alert("Submitted!", "Your talent has been submitted for moderation. It will appear on the feed once approved.");
      setShowModal(false);
      setForm({ name: '', title: '', platform: 'Youtube', link: '', description: '', category: 'Musician' });
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to save your submission.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenLink = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Cannot open this link: " + url);
      }
    } catch (error) {
      Alert.alert("Error", "An error occurred while opening the link.");
    }
  };

  const renderTalentCard = ({ item }) => {
    const getCategoryColor = (cat) => {
      switch (cat) {
        case 'Musician': return ['#4F46E5', '#000000'];
        case 'YouTuber': return ['#EF4444', '#000000'];
        case 'Artist': return ['#EC4899', '#000000'];
        case 'Developer': return ['#10B981', '#000000'];
        default: return ['#262626', '#000000'];
      }
    };

    return (
      <View style={styles.flushListing}>
        <LinearGradient
          colors={getCategoryColor(item.category)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.flushGradient}
        >
          <View style={styles.flushContent}>
            <View style={styles.topRow}>
              <View style={styles.talentInfoMain}>
                <View style={styles.badgeRow}>
                  <Text style={styles.categoryLabel}>{item.category?.toUpperCase() || 'TALENT'}</Text>
                  <View style={styles.dotSeparator} />
                  <Text style={styles.featuredBadge}>FEATURED</Text>
                </View>
                <Text style={styles.flushName}>{item.name}</Text>
              </View>
              
              <View style={styles.avatarWrapper}>
                <Image 
                  source={{ uri: `https://avatar.vercel.sh/${item.name}.png` }} 
                  style={styles.flushAvatar} 
                />
              </View>
            </View>

            <View style={styles.titleSection}>
              <Text style={styles.flushTitle}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.flushDescription}>{item.description}</Text>
              ) : null}
            </View>

            <TouchableOpacity 
              activeOpacity={0.7}
              style={styles.flushAction}
              onPress={() => handleOpenLink(item.link)}
            >
              <Text style={styles.flushActionText}>VIEW WORK</Text>
              <ExternalLink size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#FFFFFF" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LOCAL TALENT</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : (
        <FlatList
          data={talents}
          renderItem={renderTalentCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Music size={48} color="rgba(255,255,255,0.1)" />
              <Text style={styles.emptyText}>No talent showcased yet.</Text>
              <Text style={styles.emptySubtext}>Be the first to show off your skills!</Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { bottom: insets.bottom + 20 }]} 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowModal(true);
        }}
      >
        <Plus color="#000000" size={32} />
      </TouchableOpacity>

      {/* Submission Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <BlurView intensity={100} tint="dark" style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Showcase Your Talent</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.priceTag}>
                <ShieldCheck size={16} color="#10B981" />
                <Text style={styles.priceText}>One-time payment: £0.99p (Pending Moderation)</Text>
              </View>

              <Text style={styles.label}>YOUR NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="How should we call you?"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
              />

              <Text style={styles.label}>TITLE</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. My Latest Album / Photography Portfolio"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={form.title}
                onChangeText={(t) => setForm({ ...form, title: t })}
              />

                <Text style={styles.label}>CATEGORY</Text>
                <View style={styles.platformRow}>
                  {['YouTuber', 'Podcaster', 'Musician', 'Artist', 'Developer', 'Other'].map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setForm({ ...form, category: c })}
                      style={[styles.miniButton, form.category === c && styles.activeMiniButton]}
                    >
                      <Text style={[styles.miniButtonText, { color: form.category === c ? "#000000" : "#FFFFFF" }]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>PLATFORM</Text>
                <View style={styles.platformRow}>
                  {['Youtube', 'Spotify', 'Instagram', 'TikTok', 'Website'].map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setForm({ ...form, platform: p })}
                      style={[styles.platformButton, form.platform === p && styles.activePlatform]}
                    >
                      {p === 'Youtube' && <Youtube size={14} color={form.platform === p ? "#000000" : "#FFFFFF"} />}
                      {p === 'Spotify' && <Music size={14} color={form.platform === p ? "#000000" : "#FFFFFF"} />}
                      {p === 'Instagram' && <Instagram size={14} color={form.platform === p ? "#000000" : "#FFFFFF"} />}
                      {p === 'TikTok' && <Music size={14} color={form.platform === p ? "#000000" : "#FFFFFF"} />}
                      {p === 'Website' && <Globe size={14} color={form.platform === p ? "#000000" : "#FFFFFF"} />}
                      <Text style={[styles.platformText, { color: form.platform === p ? "#000000" : "#FFFFFF" }]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

              <Text style={styles.label}>LINK (URL)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="none"
                value={form.link}
                onChangeText={(t) => setForm({ ...form, link: t })}
              />

              <Text style={styles.label}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell the world about yourself..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                numberOfLines={4}
                value={form.description}
                onChangeText={(t) => setForm({ ...form, description: t })}
              />

              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={handlePurchaseAndSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.submitButtonText}>PAY £0.99 & SUBMIT</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </BlurView>
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  backButton: {
    padding: 5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 120,
  },
  flushListing: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  flushGradient: {
    width: '100%',
    minHeight: 380,
  },
  flushContent: {
    flex: 1,
    padding: 30,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  talentInfoMain: {
    flex: 1,
    marginRight: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
  },
  featuredBadge: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  flushName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  avatarWrapper: {
    padding: 2,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  flushAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  titleSection: {
    marginVertical: 30,
  },
  flushTitle: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 46,
    letterSpacing: -2,
  },
  flushDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 17,
    lineHeight: 24,
    marginTop: 15,
    fontWeight: '400',
  },
  flushAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 20,
  },
  flushActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
  },
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#FFFFFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 20,
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  closeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '700',
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  priceText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  platformRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  platformButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
    minWidth: '30%',
  },
  miniButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeMiniButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  activePlatform: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  platformText: {
    fontSize: 12,
    fontWeight: '700',
  },
  miniButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
  },
});
