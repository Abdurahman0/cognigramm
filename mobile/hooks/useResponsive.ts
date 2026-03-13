import { useWindowDimensions } from "react-native";

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const isWideDesktop = width >= 1280;
  return {
    width,
    height,
    isTablet,
    isDesktop,
    isWideDesktop
  };
};
