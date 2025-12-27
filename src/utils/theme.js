import { useColorScheme } from "react-native";

export const theme = {
  colors: {
    dark: {
      background: "#0F172A",
      surface: "#1E293B",
      surfaceHover: "#334155",
      primary: "#6366F1",
      secondary: "#EC4899",
      accent: "#8B5CF6",
      success: "#10B981",
      warning: "#F59E0B",
      danger: "#EF4444",
      text: "#F8FAFC",
      textSecondary: "#94A3B8",
      textTertiary: "#64748B",
      border: "#334155",
      separator: "#1E293B",
      overlay: "rgba(0, 0, 0, 0.7)",
      
      // Tag specific colors (Backgrounds)
      tagGeneral: "rgba(148, 163, 184, 0.15)",
      tagTraffic: "rgba(239, 68, 68, 0.15)",
      tagLostFound: "rgba(245, 158, 11, 0.15)",
      tagComplaint: "rgba(236, 72, 153, 0.15)",
      tagIncident: "rgba(244, 63, 94, 0.15)",
      tagWarning: "rgba(249, 115, 22, 0.15)",
      tagEvent: "rgba(16, 185, 129, 0.15)",
      tagShopBusiness: "rgba(59, 130, 246, 0.15)",
      tagQuestion: "rgba(139, 92, 246, 0.15)",

      // Reactions
      reactionDefault: "rgba(148, 163, 184, 0.1)",
      reactionActive: "rgba(99, 102, 241, 0.2)",
    },
    light: {
      background: "#F8FAFC",
      surface: "#FFFFFF",
      surfaceHover: "#F1F5F9",
      primary: "#6366F1",
      secondary: "#EC4899",
      accent: "#8B5CF6",
      success: "#059669",
      warning: "#D97706",
      danger: "#DC2626",
      text: "#0F172A",
      textSecondary: "#475569",
      textTertiary: "#94A3B8",
      border: "#E2E8F0",
      separator: "#F1F5F9",
      overlay: "rgba(0, 0, 0, 0.4)",
      
      tagGeneral: "rgba(71, 85, 105, 0.1)",
      tagTraffic: "rgba(220, 38, 38, 0.1)",
      tagLostFound: "rgba(217, 119, 6, 0.1)",
      tagComplaint: "rgba(219, 39, 119, 0.1)",
      tagIncident: "rgba(225, 29, 72, 0.1)",
      tagWarning: "rgba(234, 88, 12, 0.1)",
      tagEvent: "rgba(5, 150, 105, 0.1)",
      tagShopBusiness: "rgba(37, 99, 235, 0.1)",
      tagQuestion: "rgba(124, 58, 237, 0.1)",

      reactionDefault: "rgba(71, 85, 105, 0.05)",
      reactionActive: "rgba(99, 102, 241, 0.1)",
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    full: 9999,
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 24,
      fontWeight: "700",
      letterSpacing: -0.5,
    },
    h3: {
      fontSize: 20,
      fontWeight: "700",
    },
    body: {
      fontSize: 16,
      fontWeight: "400",
    },
    bodySemiBold: {
      fontSize: 16,
      fontWeight: "600",
    },
    bodyBold: {
      fontSize: 16,
      fontWeight: "700",
    },
    caption: {
      fontSize: 14,
      fontWeight: "500",
    },
    small: {
      fontSize: 12,
      fontWeight: "500",
    },
    button: {
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    }
  }
};

export const useTheme = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const currentColors = isDark ? theme.colors.dark : theme.colors.light;

  return {
    ...theme,
    colors: currentColors,
    isDark,
  };
};

export const getTagColor = (tagName, colors) => {
  const tagMap = {
    General: colors.tagGeneral,
    Traffic: colors.tagTraffic,
    "Lost & Found": colors.tagLostFound,
    Complaint: colors.tagComplaint,
    Incident: colors.tagIncident,
    Warning: colors.tagWarning,
    Event: colors.tagEvent,
    "Shop / Business": colors.tagShopBusiness,
    Question: colors.tagQuestion,
  };
  return tagMap[tagName] || colors.tagGeneral;
};
