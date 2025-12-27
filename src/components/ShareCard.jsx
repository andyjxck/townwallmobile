import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export const ShareCard = ({ post }) => {
  if (!post) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#111111', '#000000']}
        style={styles.card}
      >
        <View style={styles.header}>
          <Text style={styles.appTitle}>TOWNWALL</Text>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{post.zone?.name || "Featured"}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={3}>
            {post.title || "Latest Update"}
          </Text>
          
          <Text style={styles.body} numberOfLines={5}>
            {post.text?.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').substring(0, 200) || "Check out this update on TownWall!"}
          </Text>

          <View style={styles.footer}>
            <View style={styles.userInfo}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarEmoji}>
                  {post.is_anonymous ? "👤" : (post.user?.emoji_icon || "👤")}
                </Text>
              </View>
              <Text style={styles.username}>@{post.is_anonymous ? "Anonymous" : (post.user?.username || 'user')}</Text>
            </View>
            <Text style={styles.date}>
              {new Date(post.created_at || Date.now()).toLocaleDateString()}
            </Text>
          </View>
        </View>

          <View style={styles.branding}>
            <Text style={styles.url}>theandysocial.website/townwall</Text>
          </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width * 0.9,
    padding: 2,
    backgroundColor: '#222',
    borderRadius: 24,
    overflow: 'hidden',
  },
  card: {
    padding: 24,
    borderRadius: 22,
    minHeight: 320,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#FFFFFF',
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 34,
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
    marginBottom: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarEmoji: {
    fontSize: 18,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  date: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  branding: {
    marginTop: 20,
    alignItems: 'center',
  },
  url: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
    fontWeight: '600',
  },
});
