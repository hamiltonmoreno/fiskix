export const appColors = {
  primary: "#0058bc",    // Fiskix Electra Blue
  primaryLight: "#bfdbfe", // blue-200
  success: "#1e7e34",    // green-700
  successLight: "#bbf7d0", // green-200
  warning: "#f59e0b",    // amber-500
  danger: "#dc2626",     // red-600
  gray: {
    100: "#f3f4f6", // light background
    200: "#e5e7eb", // grid lines
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280", // secondary text
    600: "#4b5563",
    800: "#1f2937", // text main
    900: "#111827",
  },
  dark: {
    bg: "#1f2937",      // gray-800
    grid: "#374151",    // gray-700
    text: "#9ca3af",    // gray-400
    textHeading: "#f3f4f6" // gray-100
  }
};

export const chartTheme = {
  light: {
    textColor: appColors.gray[500],
    gridColor: appColors.gray[200],
    tooltipBg: "#ffffff",
    tooltipBorder: appColors.gray[200],
  },
  dark: {
    textColor: appColors.dark.text,
    gridColor: appColors.dark.grid,
    tooltipBg: appColors.gray[800],
    tooltipBorder: appColors.dark.grid,
  }
};
