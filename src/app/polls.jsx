import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator, 
  TextInput,
  Dimensions,
  FlatList,
  TouchableWithoutFeedback
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  ChevronLeft, 
  BarChart2, 
  Plus, 
  Send, 
  CheckCircle, 
  Clock,
  Trash2,
  Lock,
  MessageSquare,
  Sparkles,
  Filter,
  ArrowUpDown,
  Check,
  XCircle
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/utils/supabase';
import { getStoredUser } from '@/utils/user';
import { useTheme } from "@/utils/ThemeContext";
import { moderateContent } from '@/utils/ai';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from "expo-linear-gradient";
import { useLocationStore } from "@/utils/locationStore";

const { width } = Dimensions.get('window');

export default function PollsScreen() {
  const { isHippie } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activePolls, setActivePolls] = useState([]);
  const [userVotes, setUserVotes] = useState({});
    const [suggestion, setSuggestion] = useState('');
    const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [sortBy, setSortBy] = useState('newest');
    const [filterBy, setFilterBy] = useState('all');
    const [showFilterSortMenu, setShowFilterSortMenu] = useState(false);
  
  const { city_id } = useLocationStore();
  
  // Admin state
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

    const getFilteredSuggestions = () => {
      let filtered = [...suggestions];
      
      if (filterBy === 'mine' && user) {
        filtered = filtered.filter(s => s.user_id === user.id);
      }
      
      return filtered.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
      });
    };

    const getStatusColor = (status) => {
      switch (status?.toLowerCase()) {
        case 'approved': return '#10B981';
        case 'implemented': return '#3B82F6';
        case 'rejected': return '#EF4444';
        default: return '#F59E0B'; // pending
      }
    };

    const getCardStyle = (status) => {
      switch (status?.toLowerCase()) {
        case 'approved': return { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.05)' };
        case 'rejected': return { borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' };
        default: return {};
      }
    };

    const loadData = async () => {
    setLoading(true);
    try {
      const storedUser = await getStoredUser();
      
      // Fetch fresh user data to check admin status accurately
      const { data: userData, error: userError } = await supabase
        .from('rusers')
        .select('*')
        .eq('id', storedUser.id)
        .single();
      
      if (!userError && userData) {
        setUser(userData);
      } else {
        setUser(storedUser);
      }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: suggestionsData, error: suggestionsError } = await supabase
          .from('rfeature_suggestions')
          .select(`
            *,
            user:rusers(username, emoji_icon)
          `)
          .or(`status.eq.pending,created_at.gt.${sevenDaysAgo.toISOString()}`)
          .order('created_at', { ascending: false });

        if (suggestionsError) throw suggestionsError;
        setSuggestions(suggestionsData || []);

        const currentUser = userData || storedUser;

      // Fetch active polls
      const { data: polls, error: pollError } = await supabase
        .from('rpolls')
        .select(`
          *,
          options:rpoll_options(*)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (pollError) throw pollError;
      setActivePolls(polls || []);

      if (currentUser && polls?.length > 0) {
        // Fetch user's votes for these polls
        const pollIds = polls.map(p => p.id);
        const { data: votes, error: voteError } = await supabase
          .from('rpoll_votes')
          .select('poll_id, option_id')
          .eq('user_id', currentUser.id)
          .in('poll_id', pollIds);

        if (voteError) throw voteError;
        
        const votesMap = {};
        votes?.forEach(v => {
          votesMap[v.poll_id] = v.option_id;
        });
        setUserVotes(votesMap);

        // Fetch vote counts for each option if user has already voted
        const updatedPolls = await Promise.all(polls.map(async (poll) => {
          if (votesMap[poll.id]) {
            const { data: counts } = await supabase
              .from('rpoll_votes')
              .select('option_id')
              .eq('poll_id', poll.id);
            
            const results = {};
            counts?.forEach(c => {
              results[c.option_id] = (results[c.option_id] || 0) + 1;
            });
            return { ...poll, results, totalVotes: counts?.length || 0 };
          }
          return poll;
        }));
        setActivePolls(updatedPolls);
      }
    } catch (error) {
      console.error("Error loading polls:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (pollId, optionId) => {
    if (!user) {
      Alert.alert("Login Required", "Please sign in to vote.");
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { error } = await supabase
        .from('rpoll_votes')
        .insert({
          poll_id: pollId,
          option_id: optionId,
          user_id: user.id
        });

      if (error) {
        if (error.code === '23505') {
          Alert.alert("Already Voted", "You have already cast your vote for this poll.");
        } else {
          throw error;
        }
        return;
      }

      loadData(); // Refresh to show results
    } catch (error) {
      console.error("Error voting:", error);
      Alert.alert("Error", "Failed to cast vote.");
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestion.trim()) return;
    if (!user) {
      Alert.alert("Login Required", "Please sign in to submit suggestions.");
      return;
    }

    setIsSubmittingSuggestion(true);
    
    try {
      // AI Moderation
      const moderation = await moderateContent(suggestion.trim());
      if (moderation.status === 'rejected') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Content Policy", moderation.reason || "This suggestion doesn't meet our community standards.");
        setIsSubmittingSuggestion(false);
        return;
      }

Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const { error } = await supabase
          .from('rfeature_suggestions')
          .insert({
            user_id: user.id,
            suggestion_text: suggestion.trim(),
            city_id: city_id
          });

        if (error) throw error;
        
        setSuggestion('');
        loadData();
        Alert.alert("Thank You!", "Your feature suggestion has been submitted for review.");
    } catch (error) {
      console.error("Error submitting suggestion:", error);
      Alert.alert("Error", "Failed to submit suggestion.");
    } finally {
      setIsSubmittingSuggestion(false);
    }
  };

    const handleCreatePoll = async () => {
      if (!user?.is_admin) {
        Alert.alert("Permission Denied", "Only admins can create polls.");
        return;
      }

      if (!newPollQuestion.trim() || newPollOptions.some(o => !o.trim())) {
      Alert.alert("Incomplete", "Please provide a question and at least two options.");
      return;
    }

    setIsCreatingPoll(true);
    try {
      // AI Moderation for Poll Question
      const moderation = await moderateContent(newPollQuestion.trim());
      if (moderation.status === 'rejected') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Content Policy", moderation.reason || "This poll question doesn't meet our community standards.");
        setIsCreatingPoll(false);
        return;
      }

      // Optional: Moderate options too? Probably a good idea if we want total moderation.
      for (const option of newPollOptions) {
        if (option.trim()) {
          const optMod = await moderateContent(option.trim());
          if (optMod.status === 'rejected') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Content Policy", `Option "${option}" doesn't meet standards: ${optMod.reason}`);
            setIsCreatingPoll(false);
            return;
          }
        }
      }

const { data: poll, error: pollError } = await supabase
          .from('rpolls')
          .insert({
            question: newPollQuestion.trim(),
            is_active: true,
            city_id: city_id
          })
          .select()
          .single();

      if (pollError) throw pollError;

      const optionsToInsert = newPollOptions
        .filter(o => o.trim())
        .map(o => ({
          poll_id: poll.id,
          option_text: o.trim()
        }));

      const { error: optionsError } = await supabase
        .from('rpoll_options')
        .insert(optionsToInsert);

      if (optionsError) throw optionsError;

      setShowAdminForm(false);
      setNewPollQuestion('');
      setNewPollOptions(['', '']);
      loadData();
      Alert.alert("Success", "New feature poll created!");
    } catch (error) {
      console.error("Error creating poll:", error);
      Alert.alert("Error", "Failed to create poll.");
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const handleClosePoll = async (pollId) => {
    Alert.alert(
      "Close Poll",
      "Are you sure you want to close this poll? It will no longer be visible to users.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Close", 
          style: "destructive",
          onPress: async () => {
            if (!user?.is_admin) {
              Alert.alert("Permission Denied", "Only admins can perform this action.");
              return;
            }
            try {
              const { error } = await supabase
                .from('rpolls')
                .update({ is_active: false })
                .eq('id', pollId);
              if (error) throw error;
              loadData();
            } catch (error) {
              Alert.alert("Error", "Failed to close poll.");
            }
          }
        }
      ]
    );
  };

  const addOptionField = () => {
    if (newPollOptions.length < 5) {
      setNewPollOptions([...newPollOptions, '']);
    }
  };

  const updateOptionText = (text, index) => {
    const newOptions = [...newPollOptions];
    newOptions[index] = text;
    setNewPollOptions(newOptions);
  };

  const renderPoll = (poll) => {
    const hasVoted = userVotes[poll.id];
    
    return (
      <View key={poll.id} style={styles.pollCard}>
        <View style={styles.pollHeader}>
          <Text style={styles.pollQuestion}>{poll.question}</Text>
          {user?.is_admin && (
            <TouchableOpacity onPress={() => handleClosePoll(poll.id)}>
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.optionsContainer}>
          {poll.options?.map((option) => {
            const isSelected = hasVoted === option.id;
            const voteCount = poll.results?.[option.id] || 0;
            const percentage = poll.totalVotes > 0 ? (voteCount / poll.totalVotes) * 100 : 0;

            if (hasVoted) {
              return (
                <View key={option.id} style={styles.resultItem}>
                  <View style={styles.resultRow}>
                    <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>
                      {option.option_text}
                      {isSelected && " ✓"}
                    </Text>
                    <Text style={styles.voteCount}>{voteCount} votes ({percentage.toFixed(0)}%)</Text>
                  </View>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${percentage}%` }]} />
                  </View>
                </View>
              );
            }

            return (
              <TouchableOpacity 
                key={option.id} 
                style={styles.optionButton}
                onPress={() => handleVote(poll.id, option.id)}
              >
                <Text style={styles.optionButtonText}>{option.option_text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        <View style={styles.pollFooter}>
          <View style={styles.footerInfo}>
            <Clock size={12} color="rgba(255,255,255,0.4)" />
            <Text style={styles.footerText}>
              {hasVoted ? `${poll.totalVotes} total votes` : 'Active Poll'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={() => setShowFilterSortMenu(false)}>
      <View style={[styles.container, isHippie && { backgroundColor: 'transparent' }]}>
        {!isHippie && <LinearGradient colors={['#0F172A', '#000000', '#000000']} style={StyleSheet.absoluteFill} />}
        <View style={{ paddingTop: insets.top, flex: 1 }}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <ChevronLeft color="#FFFFFF" size={28} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>POLLS & FEATURES</Text>
              {user?.is_admin ? (
              <TouchableOpacity onPress={() => setShowAdminForm(!showAdminForm)} style={styles.backButton}>
                <Plus color={showAdminForm ? "#EF4444" : "#4ADE80"} size={28} />
              </TouchableOpacity>
            ) : <View style={{ width: 28 }} />}
          </View>

          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
          {showAdminForm && (
            <View style={styles.adminCard}>
              <Text style={styles.adminTitle}>CREATE NEW POLL</Text>
              <TextInput
                style={styles.input}
                placeholder="Feature Question (e.g., Which feature should we build next?)"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={newPollQuestion}
                onChangeText={setNewPollQuestion}
                multiline
              />
              <Text style={styles.label}>OPTIONS</Text>
              {newPollOptions.map((opt, idx) => (
                <TextInput
                  key={idx}
                  style={styles.optionInput}
                  placeholder={`Option ${idx + 1}`}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={opt}
                  onChangeText={(text) => updateOptionText(text, idx)}
                />
              ))}
              {newPollOptions.length < 5 && (
                <TouchableOpacity style={styles.addOptionBtn} onPress={addOptionField}>
                  <Plus size={16} color="#4ADE80" />
                  <Text style={styles.addOptionText}>ADD OPTION</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.createBtn} 
                onPress={handleCreatePoll}
                disabled={isCreatingPoll}
              >
                {isCreatingPoll ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.createBtnText}>LAUNCH POLL</Text>}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BarChart2 size={20} color="#3B82F6" />
              <Text style={styles.sectionTitle}>ACTIVE POLLS</Text>
            </View>
            
            {loading ? (
              <ActivityIndicator color="#FFFFFF" style={{ marginTop: 20 }} />
            ) : activePolls.length > 0 ? (
              activePolls.map(renderPoll)
            ) : (
              <View style={styles.emptyBox}>
                <Clock size={40} color="rgba(255,255,255,0.1)" />
                <Text style={styles.emptyText}>No active feature polls right now.</Text>
              </View>
            )}
          </View>

            <View style={styles.suggestionSection}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Sparkles size={20} color="#FBBF24" />
                  <Text style={styles.sectionTitle}>COMMUNITY IDEAS</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setShowFilterSortMenu(!showFilterSortMenu)}
                  style={styles.filterSortButton}
                >
                  <ArrowUpDown size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {showFilterSortMenu && (
                <View style={styles.dropdownContainer}>
                  <Text style={styles.dropdownHeader}>SORT BY</Text>
                    <TouchableOpacity 
                      style={[styles.dropdownItem, sortBy === 'newest' && { backgroundColor: '#FFF' }]} 
                      onPress={() => { setSortBy('newest'); setShowFilterSortMenu(false); }}
                    >
                      <Text style={[styles.dropdownText, sortBy === 'newest' && { color: '#000' }]}>NEWEST</Text>
                      {sortBy === 'newest' && <Check size={14} color="#000" />}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.dropdownItem, sortBy === 'oldest' && { backgroundColor: '#FFF' }]} 
                      onPress={() => { setSortBy('oldest'); setShowFilterSortMenu(false); }}
                    >
                      <Text style={[styles.dropdownText, sortBy === 'oldest' && { color: '#000' }]}>OLDEST</Text>
                      {sortBy === 'oldest' && <Check size={14} color="#000" />}
                    </TouchableOpacity>

                    <View style={styles.dropdownDivider} />
                    
                    <Text style={styles.dropdownHeader}>FILTER BY</Text>
                    <TouchableOpacity 
                      style={[styles.dropdownItem, filterBy === 'all' && { backgroundColor: '#FFF' }]} 
                      onPress={() => { setFilterBy('all'); setShowFilterSortMenu(false); }}
                    >
                      <Text style={[styles.dropdownText, filterBy === 'all' && { color: '#000' }]}>ALL IDEAS</Text>
                      {filterBy === 'all' && <Check size={14} color="#000" />}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.dropdownItem, filterBy === 'mine' && { backgroundColor: '#FFF' }]} 
                      onPress={() => { setFilterBy('mine'); setShowFilterSortMenu(false); }}
                    >
                      <Text style={[styles.dropdownText, filterBy === 'mine' && { color: '#000' }]}>MY IDEAS</Text>
                      {filterBy === 'mine' && <Check size={14} color="#000" />}
                    </TouchableOpacity>
                </View>
              )}

              <View style={[styles.suggestionCard, { marginBottom: 20 }]}>
                <Text style={styles.suggestionInfo}>
                  What else would you like to see on Town Wall? We build based on your feedback!
                </Text>
                <TextInput
                  style={styles.suggestionInput}
                  placeholder="Tell us your feature idea..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={suggestion}
                  onChangeText={setSuggestion}
                  multiline
                  maxLength={280}
                />
                <TouchableOpacity 
                  style={[styles.submitBtn, !suggestion.trim() && { opacity: 0.5 }]} 
                  onPress={handleSubmitSuggestion}
                  disabled={!suggestion.trim() || isSubmittingSuggestion}
                >
                  {isSubmittingSuggestion ? <ActivityIndicator size="small" color="#000" /> : (
                    <>
                      <Send size={16} color="#000" />
                      <Text style={styles.submitBtnText}>SUBMIT IDEA</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

                {getFilteredSuggestions().map((item) => (
                  <View key={item.id} style={[styles.ideaCard, getCardStyle(item.status)]}>
                    <View style={styles.ideaHeader}>
                    <Text style={styles.ideaUserIcon}>{item.user?.emoji_icon || '👤'}</Text>
                    <Text style={styles.ideaUsername}>{item.user?.username || 'Anonymous'}</Text>
                    <Text style={styles.ideaTime}>{getTimeAgo(new Date(item.created_at))}</Text>
                  </View>
                  <Text style={styles.ideaText}>{item.suggestion_text}</Text>
                  <View style={styles.ideaFooter}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                      <Text style={styles.statusText}>{(item.status || 'PENDING').toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
        </ScrollView>
      </View>
    </View>
    </TouchableWithoutFeedback>
    );
  }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  backButton: { padding: 5 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  
  section: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  sectionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  
  pollCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  pollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  pollQuestion: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', flex: 1, marginRight: 10 },
  optionsContainer: { gap: 10 },
  optionButton: { backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  optionButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  
  resultItem: { marginBottom: 12 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  optionText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  selectedOptionText: { color: '#4ADE80', fontWeight: '800' },
  voteCount: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' },
  progressBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 4 },
  
  pollFooter: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  footerInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' },
  
  suggestionSection: { marginTop: 10 },
  suggestionCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(251,191,36,0.1)' },
  suggestionInfo: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 20, marginBottom: 15 },
  suggestionInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 15, color: '#FFFFFF', fontSize: 15, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', marginTop: 15, paddingVertical: 14, borderRadius: 12, gap: 8 },
  submitBtnText: { color: '#000000', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  
  adminCard: { backgroundColor: 'rgba(74, 222, 128, 0.05)', borderRadius: 20, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(74, 222, 128, 0.2)' },
  adminTitle: { color: '#4ADE80', fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 15 },
  input: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 15, color: '#FFFFFF', fontSize: 15, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  label: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  optionInput: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 12, color: '#FFFFFF', fontSize: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  addOptionText: { color: '#4ADE80', fontSize: 11, fontWeight: '900' },
  createBtn: { backgroundColor: '#4ADE80', marginTop: 15, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    createBtnText: { color: '#000000', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
    
    filterSortButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.05)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    dropdownContainer: {
      position: 'absolute',
      top: 50,
      right: 0,
      width: 200,
      backgroundColor: '#1E293B',
      borderRadius: 15,
      padding: 10,
      zIndex: 1000,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 10,
    },
    dropdownHeader: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      marginBottom: 8,
      marginTop: 5,
      paddingHorizontal: 10,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    dropdownText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    dropdownDivider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.1)',
      marginVertical: 5,
    },
    ideaCard: {
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: 20,
      padding: 20,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
    },
    ideaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    ideaUserIcon: {
      fontSize: 16,
      marginRight: 8,
    },
    ideaUsername: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
      flex: 1,
    },
    ideaTime: {
      color: 'rgba(255,255,255,0.3)',
      fontSize: 11,
      fontWeight: '600',
    },
    ideaText: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 15,
    },
    ideaFooter: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    statusText: {
      color: '#000000',
      fontSize: 10,
      fontWeight: '900',
    },
    
    emptyBox: { paddingVertical: 40, alignItems: 'center', gap: 15 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '600' }
});

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "NOW";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}M`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}H`;
  return `${Math.floor(seconds / 86400)}D`;
}
