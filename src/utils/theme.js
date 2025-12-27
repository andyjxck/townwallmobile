export const theme = {
  colors: {
    primary: '#FFFFFF', // White for primary buttons on black
    secondary: '#64748B', // Slate
    accent: '#4ADE80', // Green for success/highlights
    background: '#000000', // Deep Black
    surface: '#121212', // Dark Grey surface
    text: '#FFFFFF', // Pure White text
    textSecondary: 'rgba(255, 255, 255, 0.5)',
    border: 'rgba(255, 255, 255, 0.1)',
    error: '#EF4444',
    success: '#4ADE80',
    white: '#FFFFFF',
    black: '#000000',
    card: '#121212',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  roundness: 16,
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 5,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
      elevation: 8,
    },
  },
  typography: {
    fontFamily: 'Inter',
    h1: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
    h2: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
    h3: { fontSize: 20, fontWeight: '600', letterSpacing: -0.2 },
    body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
    bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
    meta: { fontSize: 12, fontWeight: '500', letterSpacing: 0.2 },
    button: { fontSize: 16, fontWeight: '700' },
  }
};
