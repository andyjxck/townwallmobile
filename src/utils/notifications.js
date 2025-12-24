import { supabase } from './supabase';

export const sendNotification = async ({ userId, title, message, type, link }) => {
  try {
    const { error } = await supabase
      .from('rnotifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        link
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error };
  }
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
