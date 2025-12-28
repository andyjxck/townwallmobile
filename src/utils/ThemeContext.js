import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuthStore } from './auth';
import { supabase } from './supabase';

const ThemeContext = createContext({
  isHippie: false,
  toggleHippie: () => {},
  refreshTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [isHippie, setIsHippie] = useState(false);
  const user = useAuthStore(state => state.auth);

  const fetchThemeStatus = async () => {
    if (!user?.id) {
      setIsHippie(false);
      return;
    }
    const { data, error } = await supabase
      .from('rusers')
      .select('hippie_theme_enabled')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setIsHippie(!!data.hippie_theme_enabled);
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
    <ThemeContext.Provider value={{ isHippie, toggleHippie, refreshTheme: fetchThemeStatus }}>
      {children}
    </ThemeContext.Provider>
  );
};
