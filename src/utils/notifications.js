import { supabase } from './supabase';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isOnline } from './user';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Don't show notifications when app is in foreground
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

let hasLoggedDeviceWarning = false;

export async function registerForPushNotificationsAsync(userId) {
  let token;
  
  if (Platform.OS === 'web') {
    return null;
  }

  if (!Device.isDevice) {
    if (!hasLoggedDeviceWarning) {
      console.log('Push notifications require a physical device');
      hasLoggedDeviceWarning = true;
    }
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    
    if (!projectId) {
      console.log('Project ID not found for push notifications. Please configure EAS project ID.');
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('Expo Push Token:', token);

    if (userId && token) {
      await supabase
        .from('rusers')
        .update({ push_token: token })
        .eq('id', userId);
    }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#22C55E',
        });
        
        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Messages',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#22C55E',
          sound: 'message.mp3',
        });

          await Notifications.setNotificationChannelAsync('calls', {
            name: 'Calls',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#22C55E',
            sound: 'ringtone.mp3',
          });

          await Notifications.setNotificationChannelAsync('alerts', {
            name: 'Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#22C55E',
            sound: 'alert.mp3',
          });
        }
  } catch (error) {
    console.error('Error registering for push notifications:', error);
  }

  return token;
}

export async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken) return;
  
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    const result = await response.json();
    if (result.data?.status === 'error') {
      console.error('Push notification error:', result.data.message);
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

    export const sendNotification = async ({ userId, title, message, type, link }) => {
      try {
        // For reactions and shares, we want to be very strict to prevent spamming.
        // We only ever send the FIRST notification for these types per specific content/link.
        const isStrictType = ['reaction', 'share'].includes(type);
        
        let query = supabase
          .from('rnotifications')
          .select('id')
          .eq('user_id', userId)
          .eq('type', type);

        if (isStrictType) {
          // For reactions/shares, check if THIS specific notification (based on link/post) already exists
          if (link) query = query.eq('link', link);
          // If it's a reaction, we also want to avoid spamming the same user even if the message varies slightly
          // but usually the message is unique per reactor anyway.
          // To be safe, we check if ANY notification of this type for this content already exists.
        } else {
          // For others, use a 1-minute window
          const timeWindow = new Date(Date.now() - 60000).toISOString();
          query = query.eq('title', title).eq('message', message).gt('created_at', timeWindow);
        }
    
        const { data: existing } = await query.limit(1);
    
        if (existing && existing.length > 0) {
          console.log(`Skipping duplicate notification (type: ${type})`);
          return { success: true, skipped: true };
        }
  
      const { data: newNotification, error } = await supabase
        .from('rnotifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          link
        })
        .select('*')
        .single();
  
      if (error) throw error;
  
      return { success: true, data: newNotification };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error };
    }
  };

export const sendMessageNotification = async ({ senderId, receiverId, senderUsername, messageText }) => {
  return sendNotification({
    userId: receiverId,
    title: `New message from @${senderUsername}`,
    message: messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText,
    type: 'message',
    link: `/chat`
  });
};

export const sendReactionNotification = async ({ reactorUsername, reactorId, postOwnerId, postTitle, reactionType }) => {
  if (reactorId === postOwnerId) return { success: true, skipped: true };
  
  const reactionLabel = reactionType === 'helpful' ? 'liked' : reactionType === 'superlike' ? 'superliked' : 'reacted to';
  
  return sendNotification({
    userId: postOwnerId,
    title: `New ${reactionType === 'superlike' ? 'Superlike' : 'Like'}!`,
    message: `@${reactorUsername} ${reactionLabel} your post: "${postTitle || 'Untitled'}"`,
    type: 'reaction',
    link: `/post`
  });
};

export const sendFriendRequestNotification = async ({ senderId, senderUsername, receiverId }) => {
  return sendNotification({
    userId: receiverId,
    title: 'New Friend Request!',
    message: `@${senderUsername} wants to be your friend`,
    type: 'friend_request',
    link: `/profile`
  });
};

export const sendFriendAcceptedNotification = async ({ acceptorId, acceptorUsername, requesterId }) => {
  return sendNotification({
    userId: requesterId,
    title: 'Friend Request Accepted!',
    message: `@${acceptorUsername} accepted your friend request`,
    type: 'friend_accepted',
    link: `/profile?userId=${acceptorId}`
  });
};

export const sendShareNotification = async ({ sharerUsername, sharerId, postOwnerId, postTitle }) => {
  if (sharerId === postOwnerId) return { success: true, skipped: true };
  
  return sendNotification({
    userId: postOwnerId,
    title: 'Your Post Was Shared!',
    message: `@${sharerUsername} shared your post: "${postTitle || 'Untitled'}"`,
    type: 'share',
    link: `/post`
  });
};

export const sendCommentNotification = async ({ commenterUsername, commenterId, postOwnerId, postTitle, commentText }) => {
  if (commenterId === postOwnerId) return { success: true, skipped: true };
  
  return sendNotification({
    userId: postOwnerId,
    title: 'New Comment!',
    message: `@${commenterUsername} commented: "${commentText.length > 30 ? commentText.substring(0, 30) + '...' : commentText}"`,
    type: 'comment',
    link: `/post`
  });
};

export const sendHelpMessageNotification = async ({ senderId, senderUsername, receiverId, isFromAdmin, messageContent }) => {
  return sendNotification({
    userId: receiverId,
    title: isFromAdmin ? 'Support Response' : `Help message from @${senderUsername}`,
    message: messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent,
    type: 'help_message',
    link: `/help`
  });
};

export const fetchNotifications = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('rnotifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

export const markAsRead = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('rnotifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error };
  }
};

export const markAllAsRead = async (userId) => {
  try {
    const { error } = await supabase
      .from('rnotifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error };
  }
};

export const getUnreadCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('rnotifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

export const subscribeToNotifications = (userId, onNewNotification) => {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'rnotifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNewNotification(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToUnreadCount = (userId, onCountChange) => {
  const fetchCount = async () => {
    const count = await getUnreadCount(userId);
    onCountChange(count);
  };

  fetchCount();

  const channel = supabase
    .channel(`unread_count:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rnotifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        fetchCount();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
