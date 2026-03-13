import Toast from "react-native-toast-message";

export const useAppToast = () => {
  const success = (title: string, message?: string) => {
    Toast.show({ type: "success", text1: title, text2: message });
  };
  const error = (title: string, message?: string) => {
    Toast.show({ type: "error", text1: title, text2: message });
  };
  const info = (title: string, message?: string) => {
    Toast.show({ type: "info", text1: title, text2: message });
  };
  return { success, error, info };
};
