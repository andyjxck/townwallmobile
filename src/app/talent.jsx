import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, Image, Platform, FlatList, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Music, Youtube, Globe, Info, Plus, ExternalLink, ShieldCheck, Instagram, CheckCircle2, Star, Camera, Search, X } from 'lucide-react-native';

export default function LocalTalent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [talents, setTalents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  const categories = ['YouTuber', 'Podcaster', 'Musician', 'Artist', 'Developer', 'Photography', 'Other'];

  const [form, setForm] = useState({
      name: '',
      title: '',
      platform: 'Youtube',
      link: '',
      description: '',
      category: 'YouTuber',
      avatar: null
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
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTalents(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setForm({ ...form, avatar: result.assets[0] });
    }
  };

  const uploadImage = async (userId) => {
    if (!form.avatar) return null;
    
    try {
      const fileName = `${userId || 'anon'}_${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('talent_avatars')
        .upload(filePath, decode(form.avatar.base64), {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('talent_avatars')
        .getPublicUrl(filePath);
        
      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
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
      
      let avatarUrl = null;
      if (form.avatar) {
        avatarUrl = await uploadImage(user?.id);
      }

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
          avatar_url: avatarUrl,
          payment_status: paymentStatus,
          status: 'pending' // Moderation pending
        });

      if (error) throw error;
      
      Alert.alert("Submitted!", "Your talent has been submitted for moderation. It will appear on the feed once approved.");
      setShowModal(false);
      setForm({ name: '', title: '', platform: 'Youtube', link: '', description: '', category: 'Musician', avatar: null });
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

  const getPlatformIcon = (platform) => {
    const p = platform?.toLowerCase() || '';
    if (p.includes('youtube')) return <Youtube size={16} color="rgba(255,255,255,0.5)" />;
    if (p.includes('spotify') || p.includes('music') || p.includes('tiktok')) return <Music size={16} color="rgba(255,255,255,0.5)" />;
    if (p.includes('instagram')) return <Instagram size={16} color="rgba(255,255,255,0.5)" />;
    return <Globe size={16} color="rgba(255,255,255,0.5)" />;
  };

  const renderTalentCard = ({ item }) => {
    return (
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => handleOpenLink(item.link)}
        style={styles.talentItem}
      >
        <View style={styles.talentRow}>
          <View style={styles.talentMain}>
            <View style={styles.categoryRow}>
              <Text style={styles.categoryText}>{item.category?.toUpperCase() || 'TALENT'}</Text>
              <View style={styles.platformBadge}>
                {getPlatformIcon(item.platform)}
                <Text style={styles.platformLabel}>{item.platform?.toUpperCase()}</Text>
              </View>
            </View>
            
            <Text style={styles.talentNameText}>{item.name}</Text>
            <Text style={styles.talentTitleText}>{item.title}</Text>
            
            {item.description ? (
              <Text style={styles.talentDescText} numberOfLines={2}>{item.description}</Text>
            ) : null}

            <View style={styles.visitAction}>
              <Text style={styles.visitText}>VISIT {item.platform?.toUpperCase() || 'LINK'}</Text>
              <ExternalLink size={12} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </View>
          
          <View style={styles.talentSide}>
            <Image 
              source={{ uri: item.avatar_url || `https://avatar.vercel.sh/${item.name}.png` }} 
              style={styles.minimalAvatar} 
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredTalents = talents.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#000000', '#000000']}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ paddingTop: insets.top, flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft color="#FFFFFF" size={24} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>LOCAL TALENT</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search size={18} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search talent..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            ) : null}
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.categoryScroll}
          >
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedCategory(null);
              }}
              style={[styles.categoryPill, !selectedCategory && styles.activeCategoryPill]}
            >
              <Text style={[styles.categoryPillText, !selectedCategory && styles.activeCategoryPillText]}>ALL</Text>
            </TouchableOpacity>
            {categories.map(cat => (
              <TouchableOpacity 
                key={cat}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedCategory(cat);
                }}
                style={[styles.categoryPill, selectedCategory === cat && styles.activeCategoryPill]}
              >
                <Text style={[styles.categoryPillText, selectedCategory === cat && styles.activeCategoryPillText]}>
                  {cat.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : (
          <FlatList
            data={filteredTalents}
            renderItem={renderTalentCard}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Music size={48} color="rgba(255,255,255,0.1)" />
                <Text style={styles.emptyText}>No talent found.</Text>
                <Text style={styles.emptySubtext}>Try a different search or category.</Text>
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
        </View>

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

              <Text style={styles.label}>PROFILE IMAGE</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {form.avatar ? (
                  <Image source={{ uri: form.avatar.uri }} style={styles.pickedImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Camera size={24} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.imagePlaceholderText}>Upload Photo</Text>
                  </View>
                )}
              </TouchableOpacity>

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
  searchSection: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    height: 44,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeCategoryPill: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  categoryPillText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  activeCategoryPillText: {
    color: '#000000',
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
  talentItem: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  talentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  talentMain: {
    flex: 1,
    paddingRight: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  platformLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  categoryText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  talentNameText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 1,
    marginBottom: 4,
    opacity: 0.6,
  },
  talentTitleText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  talentDescText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    fontWeight: '400',
  },
  visitAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    alignSelf: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingBottom: 4,
  },
  visitText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  talentSide: {
    alignItems: 'center',
    gap: 12,
  },
  minimalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  linkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#FFFFFF',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
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
      backgroundColor: '#000000',
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      padding: 30,
      maxHeight: '92%',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 32,
    },
    modalTitle: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '300',
      letterSpacing: -0.5,
    },
    closeText: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 14,
      fontWeight: '500',
    },
    priceTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      padding: 16,
      borderRadius: 16,
      marginBottom: 32,
      gap: 10,
    },
    priceText: {
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: 13,
      fontWeight: '400',
    },
    label: {
      color: 'rgba(255,255,255,0.3)',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
      marginBottom: 12,
      marginTop: 20,
    },
    input: {
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
      paddingVertical: 12,
      color: '#FFFFFF',
      fontSize: 17,
      marginBottom: 10,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    platformRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
      flexWrap: 'wrap',
    },
    platformButton: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    miniButton: {
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 100,
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
      fontSize: 13,
      fontWeight: '600',
    },
    miniButtonText: {
      fontSize: 13,
      fontWeight: '600',
    },
    submitButton: {
      backgroundColor: '#FFFFFF',
      borderRadius: 100,
      padding: 20,
      alignItems: 'center',
      marginTop: 40,
    },
      submitButtonText: {
        color: '#000000',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 1,
      },
      imagePicker: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        marginBottom: 10,
      },
      pickedImage: {
        width: '100%',
        height: '100%',
      },
      imagePlaceholder: {
        alignItems: 'center',
        gap: 4,
      },
      imagePlaceholderText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        fontWeight: '600',
      },
  });
