import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";

export const useCurrentUser = () => {
  const sessionUserId = useAuthStore((state) => state.session?.userId);
  const fallbackUser = useAuthStore((state) => state.currentUser);
  return useChatStore((state) => {
    const targetId = sessionUserId ?? fallbackUser.id;
    const user = state.users.find((candidate) => candidate.id === targetId);
    return user ?? fallbackUser;
  });
};
