import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuthStore } from './auth';
import { supabase } from './supabase';
import { theme } from './theme';

const ThemeContext = createContext({
  isHippie: false,
  isUnlocked: false,
  theme: theme,
  toggleHippie: () => {},
  refreshTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [isHippie, setIsHippie] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const hippieTheme = {
    ...theme,
    colors: {
      ...theme.colors,
      background: 'transparent',
      surface: 'rgba(255, 255, 255, 0.05)',
      card: 'rgba(255, 255, 255, 0.08)',
      textSecondary: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.1)',
    }
  };

  const activeTheme = isHippie ? hippieTheme : theme;
  const user = useAuthStore(state => state.auth);

  const fetchThemeStatus = async () => {
    if (!user?.id) {
      setIsHippie(false);
      setIsUnlocked(false);
      return;
    }
    const { data } = await supabase
      .from('rusers')
      .select('hippie_theme_enabled, hippie_discovered_at')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setIsHippie(!!data.hippie_theme_enabled);
      setIsUnlocked(!!data.hippie_discovered_at);
    }
  };

  useEffect(() => {
    fetchThemeStatus();
  }, [user?.id]);

  const toggleHippie = async (enabled) => {
    if (!user?.id) return;
    
    const { error } = await supabase
      .from('rusers')
      .update({ hippie_theme_enabled: enabled })
      .eq('id', user.id);
    
    if (!error) {
      setIsHippie(enabled);
    }
  };

  return (
    <ThemeContext.Provider value={{ isHippie, isUnlocked, theme: activeTheme, toggleHippie, refreshTheme: fetchThemeStatus }}>
      {children}
    </ThemeContext.Provider>
  );
};
