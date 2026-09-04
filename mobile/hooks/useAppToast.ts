import { notify } from "@/store/notificationStore";

/**
 * Raises a notification card. The name is historical — these are now the app's own
 * glass notifications rather than a third-party toast.
 */
export const useAppToast = () => {
  const success = (title: string, message?: string) => {
    notify("success", title, message);
  };
  const error = (title: string, message?: string) => {
    notify("error", title, message);
  };
  const info = (title: string, message?: string) => {
    notify("info", title, message);
  };
  return { success, error, info };
};
