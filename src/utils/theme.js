import { useColorScheme } from "react-native";

export const useTheme = () => {
  const colorScheme = useColorScheme();

  const colors = {
    light: {
      background: "#FFFFFF",
      surface: "#FFFFFF",
      text: "#070728",
      textSecondary: "#8E8E99",
      textTertiary: "rgba(7, 7, 40, 0.5)",
      separator: "rgba(0, 0, 0, 0.08)",
      overlay: "rgba(0, 0, 0, 0.4)",

      // Tag colors
      tagGeneral: "rgba(142, 142, 153, 0.12)",
      tagTraffic: "rgba(255, 59, 48, 0.12)",
      tagLostFound: "rgba(255, 149, 0, 0.12)",
      tagComplaint: "rgba(255, 204, 0, 0.12)",
      tagIncident: "rgba(255, 45, 85, 0.12)",
      tagWarning: "rgba(255, 59, 48, 0.12)",
      tagEvent: "rgba(52, 199, 89, 0.12)",
      tagShopBusiness: "rgba(0, 122, 255, 0.12)",
      tagQuestion: "rgba(175, 82, 222, 0.12)",

      // Reaction colors
      reactionDefault: "rgba(0, 0, 0, 0.05)",
      reactionActive: "rgba(0, 0, 0, 0.12)",

      // Zone pill
      zonePill: "rgba(0, 0, 0, 0.06)",
    },
    dark: {
      background: "#000000",
      surface: "#000000",
      text: "rgba(255, 255, 255, 0.92)",
      textSecondary: "rgba(255, 255, 255, 0.55)",
      textTertiary: "rgba(255, 255, 255, 0.3)",
      separator: "rgba(255, 255, 255, 0.08)",
      overlay: "rgba(0, 0, 0, 0.7)",

      // Tag colors
      tagGeneral: "rgba(142, 142, 153, 0.2)",
      tagTraffic: "rgba(255, 69, 58, 0.2)",
      tagLostFound: "rgba(255, 159, 10, 0.2)",
      tagComplaint: "rgba(255, 214, 10, 0.2)",
      tagIncident: "rgba(255, 55, 95, 0.2)",
      tagWarning: "rgba(255, 69, 58, 0.2)",
      tagEvent: "rgba(48, 209, 88, 0.2)",
      tagShopBusiness: "rgba(10, 132, 255, 0.2)",
      tagQuestion: "rgba(191, 90, 242, 0.2)",

      // Reaction colors
      reactionDefault: "rgba(255, 255, 255, 0.08)",
      reactionActive: "rgba(255, 255, 255, 0.16)",

      // Zone pill
      zonePill: "rgba(255, 255, 255, 0.1)",
    },
  };

  return {
    colors: colors[colorScheme] || colors.dark,
    isDark: colorScheme === "dark",
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
