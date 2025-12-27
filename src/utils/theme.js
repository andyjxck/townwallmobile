export const theme = {
  colors: {
    primary: '#0EA5E9', // Sky Blue
    secondary: '#64748B', // Slate
    accent: '#F59E0B', // Amber
    background: '#F8FAFC', // Very Light Slate
    surface: '#FFFFFF',
    text: '#0F172A', // Deep Slate
    textSecondary: '#64748B',
    border: '#E2E8F0',
    error: '#EF4444',
    success: '#10B981',
    white: '#FFFFFF',
    black: '#000000',
    card: '#FFFFFF',
    overlay: 'rgba(15, 23, 42, 0.5)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  roundness: 20, // Modern large rounding
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 5,
    },
    large: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
  },
  typography: {
    fontFamily: 'Inter',
    h1: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
    h2: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3 },
    h3: { fontSize: 20, fontWeight: '600', letterSpacing: -0.2 },
    body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
    bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
    meta: { fontSize: 12, fontWeight: '500', letterSpacing: 0.2 },
    button: { fontSize: 16, fontWeight: '600' },
  }
};
