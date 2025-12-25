import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { supabase } from '@/utils/supabase';
import { getStoredUser } from '@/utils/user';
import * as Haptics from 'expo-haptics';
import { Clock } from 'lucide-react-native';

export default function PollComponent({ pollId, onVoteChange }) {
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadPollData();

    const channel = supabase
      .channel(`poll_${pollId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'rpoll_votes', 
        filter: `poll_id=eq.${pollId}` 
      }, () => {
        loadPollData();
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'rpolls', 
        filter: `id=eq.${pollId}` 
      }, () => {
        loadPollData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId]);

  const loadPollData = async () => {
    try {
      const storedUser = await getStoredUser();
      setUser(storedUser);

      const { data: pollData, error: pollError } = await supabase
        .from('rpolls')
        .select(`
          *,
          options:rpoll_options(*)
        `)
        .eq('id', pollId)
        .single();

      if (pollError) throw pollError;

      if (storedUser) {
        const { data: voteData } = await supabase
          .from('rpoll_votes')
          .select('option_id')
          .eq('poll_id', pollId)
          .eq('user_id', storedUser.id)
          .maybeSingle();
        
        if (voteData) setUserVote(voteData.option_id);
      }

      // Fetch all votes for this poll to calculate results
      const { data: allVotes } = await supabase
        .from('rpoll_votes')
        .select('option_id')
        .eq('poll_id', pollId);

      const results = {};
      allVotes?.forEach(v => {
        results[v.option_id] = (results[v.option_id] || 0) + 1;
      });

      setPoll({
        ...pollData,
        results,
        totalVotes: allVotes?.length || 0
      });
    } catch (error) {
      console.error("Error loading poll:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (optionId) => {
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
          Alert.alert("Already Voted", "You have already cast your vote.");
        } else {
          throw error;
        }
        return;
      }

      loadPollData();
      if (onVoteChange) onVoteChange();
    } catch (error) {
      console.error("Error voting:", error);
      Alert.alert("Error", "Failed to cast vote.");
    }
  };

  if (loading) return <ActivityIndicator color="#FFFFFF" style={{ marginVertical: 10 }} />;
  if (!poll) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{poll.question}</Text>
      
      <View style={styles.optionsContainer}>
        {poll.options?.map((option) => {
          const isSelected = userVote === option.id;
          const voteCount = poll.results?.[option.id] || 0;
          const percentage = poll.totalVotes > 0 ? (voteCount / poll.totalVotes) * 100 : 0;

          if (userVote) {
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
              onPress={() => handleVote(option.id)}
            >
              <Text style={styles.optionButtonText}>{option.option_text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      <View style={styles.footer}>
        <Clock size={12} color="rgba(255,255,255,0.4)" />
        <Text style={styles.footerText}>
          {userVote ? `${poll.totalVotes} total votes` : 'Active Poll'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  question: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 10,
  },
  optionButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  optionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  resultItem: {
    marginBottom: 10,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  optionText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  selectedOptionText: {
    color: '#4ADE80',
    fontWeight: '800',
  },
  voteCount: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
  },
  progressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  footer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
  },
});
