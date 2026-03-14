import { Platform, useWindowDimensions } from "react-native";

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isTablet = !isWeb && width >= 768;
  const isDesktop = !isWeb && width >= 1024;
  const isWideDesktop = !isWeb && width >= 1280;
  return {
    width,
    height,
    isTablet,
    isDesktop,
    isWideDesktop
  };
};
