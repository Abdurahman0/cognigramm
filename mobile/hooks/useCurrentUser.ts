import { CURRENT_USER_ID } from "@/mock";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";

export const useCurrentUser = () => {
  const sessionUserId = useAuthStore((state) => state.session?.userId);
  const fallbackUser = useAuthStore((state) => state.currentUser);
  return useChatStore((state) => {
    const user = state.users.find((candidate) => candidate.id === (sessionUserId ?? CURRENT_USER_ID));
    return user ?? fallbackUser;
  });
};
