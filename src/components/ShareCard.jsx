import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { User, MapPin } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;

export function ShareCard({ post }) {
  if (!post) return null;

  const images = post.image_urls || (post.image_url ? [post.image_url] : []);
  const mainImage = images[0];

    const stripHtml = (html) => {
      if (!html) return '';
      // Replace block tags and line breaks with newlines before stripping
      let cleaned = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
        .replace(/<[^>]*>?/gm, '');
        
      // Strip common Markdown patterns (bold, italic, links)
      cleaned = cleaned
        .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
        .replace(/(\*|_)(.*?)\1/g, '$2')    // italic
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // links
        .replace(/#{1,6}\s+(.*)/g, '$1')     // headers
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&');
      
      return cleaned.trim();
    };

    const plainText = stripHtml(post.text);

    return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1E293B', '#0F172A']}
        style={styles.card}
      >
        {/* Header with Logo */}
        <View style={styles.header}>
          <Text style={styles.logoText}>TOWN WALL</Text>
            <View style={styles.zoneBadge}>
              <MapPin size={10} color="#FFFFFF" />
              <Text style={styles.zoneName}>{post.zone?.name?.toUpperCase() || 'LOCAL'}</Text>
            </View>
          </View>

          {/* Content Section */}
            <View style={styles.content}>
              {mainImage && (
                <Image
                  source={{ uri: mainImage }}
                  style={styles.mainImage}
                  contentFit="cover"
                />
              )}
              
              <Text style={styles.title} numberOfLines={2}>
                {post.title || 'Untitled Post'}
              </Text>
              
                <Text style={styles.body}>
                  {plainText}
                </Text>
            </View>

            {/* Footer with Author and App Info */}
            <View style={styles.footer}>
              <View style={styles.authorInfo}>
                {post.user?.avatar_url ? (
                  <Image 
                    source={{ uri: post.user.avatar_url }} 
                    style={styles.avatar} 
                  />
                ) : post.user?.emoji_icon ? (
                  <Text style={styles.emojiIcon}>{post.user.emoji_icon}</Text>
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <User size={12} color="rgba(255,255,255,0.4)" />
                  </View>
                )}
                <Text style={styles.username}>
                  @{post.is_anonymous ? 'anonymous' : (post.user?.username || 'user')}
                </Text>
              </View>
            
            <View style={styles.appPromo}>
              <Text style={styles.promoText}>Download on iOS</Text>
            </View>
          </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#000000', // Transparent or black for capture
    width: CARD_WIDTH + 40,
    alignItems: 'center',
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  zoneName: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  content: {
    gap: 12,
  },
  mainImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  body: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  emojiIcon: {
    fontSize: 18,
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  appPromo: {
    alignItems: 'flex-end',
  },
  promoText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  appUrl: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
