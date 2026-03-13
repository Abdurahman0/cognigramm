import type { CallLogItem, ChatMessage, ChatSummary, ChannelTemplate, SharedFileItem, User } from "@/types";

const now = Date.now();
const ago = (minutes: number): string => new Date(now - minutes * 60 * 1000).toISOString();

export const CURRENT_USER_ID = "u_amina";

export const mockUsers: User[] = [
  {
    id: "u_amina",
    fullName: "Amina Rahimova",
    email: "amina.rahimova@company.local",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop",
    role: "manager",
    department: "Engineering",
    title: "Engineering Manager",
    presence: "available",
    isOnline: true,
    about: "Leading platform delivery and architecture initiatives.",
    timezone: "Asia/Tashkent"
  },
  {
    id: "u_ceo",
    fullName: "Daniel Foster",
    email: "daniel.foster@company.local",
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop",
    role: "ceo",
    department: "Executive",
    title: "Chief Executive Officer",
    presence: "in_meeting",
    isOnline: true,
    about: "Focused on growth, strategy, and execution discipline.",
    timezone: "Europe/London"
  },
  {
    id: "u_cto",
    fullName: "Sardor Karimov",
    email: "sardor.karimov@company.local",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
    role: "cto",
    department: "Executive",
    title: "Chief Technology Officer",
    presence: "busy",
    isOnline: true,
    about: "Platform standards, reliability, and security.",
    timezone: "Asia/Tashkent"
  },
  {
    id: "u_hr",
    fullName: "Madina Sodiqova",
    email: "madina.sodiqova@company.local",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop",
    role: "hr",
    department: "HR",
    title: "HR Business Partner",
    presence: "available",
    isOnline: true,
    about: "People operations and internal programs.",
    timezone: "Asia/Tashkent"
  },
  {
    id: "u_dev_1",
    fullName: "Bekzod Usmonov",
    email: "bekzod.usmonov@company.local",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop",
    role: "developer",
    department: "Engineering",
    title: "Senior Backend Engineer",
    presence: "remote",
    isOnline: true,
    about: "API design, performance, and observability.",
    timezone: "Asia/Tashkent"
  },
  {
    id: "u_dev_2",
    fullName: "Nargiza Ismailova",
    email: "nargiza.ismailova@company.local",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop",
    role: "developer",
    department: "Engineering",
    title: "Frontend Engineer",
    presence: "busy",
    isOnline: true,
    about: "Product UX implementation and app performance.",
    timezone: "Asia/Tashkent"
  },
  {
    id: "u_des_1",
    fullName: "Umidjon Kadirov",
    email: "umidjon.kadirov@company.local",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop",
    role: "designer",
    department: "Design",
    title: "Lead Product Designer",
    presence: "available",
    isOnline: true,
    about: "Design systems and product UX strategy.",
    timezone: "Asia/Tashkent"
  },
  {
    id: "u_prod_1",
    fullName: "Dilnoza Ahmedova",
    email: "dilnoza.ahmedova@company.local",
    avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&fit=crop",
    role: "product",
    department: "Product",
    title: "Product Lead",
    presence: "on_break",
    isOnline: false,
    about: "Roadmap planning and customer impact.",
    timezone: "Asia/Tashkent"
  },
  {
    id: "u_qa_1",
    fullName: "Shukhrat Nurmatov",
    email: "shukhrat.nurmatov@company.local",
    avatar: "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=200&h=200&fit=crop",
    role: "qa",
    department: "Engineering",
    title: "QA Automation Engineer",
    presence: "available",
    isOnline: true,
    about: "Release quality and risk controls.",
    timezone: "Asia/Tashkent"
  },
  {
    id: "u_ops_1",
    fullName: "Akmal Ruziev",
    email: "akmal.ruziev@company.local",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
    role: "manager",
    department: "Operations",
    title: "Operations Manager",
    presence: "offline",
    isOnline: false,
    about: "Delivery operations and incident coordination.",
    timezone: "Asia/Tashkent"
  },
  {
    id: "u_sales_1",
    fullName: "Aziza Karimova",
    email: "aziza.karimova@company.local",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
    role: "manager",
    department: "Sales",
    title: "Enterprise Sales Manager",
    presence: "remote",
    isOnline: true,
    about: "Enterprise opportunities and account growth.",
    timezone: "Asia/Tashkent"
  },
  {
    id: "u_intern_1",
    fullName: "Jahongir Yusupov",
    email: "jahongir.yusupov@company.local",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    role: "intern",
    department: "Engineering",
    title: "Software Engineering Intern",
    presence: "available",
    isOnline: true,
    about: "Learning through frontend and tooling tasks.",
    timezone: "Asia/Tashkent"
  }
];

export const mockChannels: ChannelTemplate[] = [
  {
    id: "channel_eng",
    name: "Engineering",
    kind: "channel",
    description: "Daily delivery updates, architecture decisions, and blockers.",
    departmentLabel: "Engineering"
  },
  {
    id: "channel_exec_ann",
    name: "Leadership Announcements",
    kind: "announcement",
    description: "Company-wide executive updates and policy communication.",
    departmentLabel: "Executive"
  },
  {
    id: "channel_product",
    name: "Product Planning",
    kind: "channel",
    description: "Roadmap alignment, release scope, and customer priorities.",
    departmentLabel: "Product"
  }
];

export const mockChats: ChatSummary[] = [
  {
    id: "chat_exec_announce",
    title: "Leadership Announcements",
    subtitle: "Official company updates",
    kind: "announcement",
    memberIds: ["u_ceo", "u_cto", "u_hr", "u_amina", "u_dev_1", "u_dev_2", "u_prod_1", "u_des_1", "u_qa_1"],
    unreadCount: 2,
    pinned: true,
    archived: false,
    muted: false,
    typingUserIds: [],
    hasMentions: true,
    departmentLabel: "Executive",
    isAnnouncementLocked: true
  },
  {
    id: "chat_eng_channel",
    title: "Engineering",
    subtitle: "Delivery and platform coordination",
    kind: "channel",
    memberIds: ["u_amina", "u_cto", "u_dev_1", "u_dev_2", "u_qa_1", "u_intern_1"],
    unreadCount: 4,
    pinned: true,
    archived: false,
    muted: false,
    typingUserIds: ["u_dev_2", "u_intern_1"],
    departmentLabel: "Engineering"
  },
  {
    id: "chat_product_squad",
    title: "Product Launch Squad",
    subtitle: "Cross-functional rollout workstream",
    kind: "group",
    memberIds: ["u_amina", "u_prod_1", "u_des_1", "u_dev_2", "u_qa_1"],
    unreadCount: 0,
    pinned: false,
    archived: false,
    muted: false,
    typingUserIds: [],
    departmentLabel: "Product"
  },
  {
    id: "chat_dm_ceo",
    title: "Daniel Foster",
    kind: "direct",
    memberIds: ["u_amina", "u_ceo"],
    unreadCount: 1,
    pinned: false,
    archived: false,
    muted: false,
    typingUserIds: ["u_ceo"]
  },
  {
    id: "chat_dm_hr",
    title: "Madina Sodiqova",
    kind: "direct",
    memberIds: ["u_amina", "u_hr"],
    unreadCount: 0,
    pinned: false,
    archived: false,
    muted: true,
    typingUserIds: []
  },
  {
    id: "chat_design_review",
    title: "Design Review Board",
    subtitle: "Weekly design critiques",
    kind: "group",
    memberIds: ["u_amina", "u_des_1", "u_prod_1", "u_dev_2"],
    unreadCount: 0,
    pinned: false,
    archived: false,
    muted: false,
    typingUserIds: []
  },
  {
    id: "chat_ops_war_room",
    title: "Ops Incident Room",
    subtitle: "Escalations and incident tracking",
    kind: "channel",
    memberIds: ["u_amina", "u_ops_1", "u_dev_1", "u_qa_1"],
    unreadCount: 0,
    pinned: false,
    archived: true,
    muted: false,
    typingUserIds: [],
    departmentLabel: "Operations"
  },
  {
    id: "chat_sales_exec",
    title: "Sales + Exec Sync",
    subtitle: "Enterprise negotiation updates",
    kind: "group",
    memberIds: ["u_amina", "u_sales_1", "u_ceo"],
    unreadCount: 0,
    pinned: false,
    archived: false,
    muted: false,
    typingUserIds: [],
    departmentLabel: "Sales"
  }
];

export const mockMessages: Record<string, ChatMessage[]> = {
  chat_exec_announce: [
    {
      id: "m1",
      chatId: "chat_exec_announce",
      senderId: "u_ceo",
      body: "Company update: Q2 hiring has been approved for Engineering and Product.",
      type: "text",
      priority: "important",
      createdAt: ago(320),
      status: "seen",
      seenByIds: ["u_amina", "u_dev_1", "u_dev_2"],
      deliveredToIds: ["u_hr", "u_prod_1", "u_des_1", "u_qa_1"]
    },
    {
      id: "m2",
      chatId: "chat_exec_announce",
      senderId: "u_hr",
      body: "Please submit team onboarding plans by Friday 18:00.",
      type: "text",
      priority: "normal",
      createdAt: ago(280),
      status: "delivered",
      seenByIds: ["u_amina"],
      deliveredToIds: ["u_dev_1", "u_dev_2", "u_prod_1"]
    },
    {
      id: "m3",
      chatId: "chat_exec_announce",
      senderId: "u_ceo",
      body: "Security training is now mandatory for all departments.",
      type: "text",
      priority: "urgent",
      createdAt: ago(145),
      status: "delivered",
      seenByIds: ["u_amina"],
      deliveredToIds: ["u_dev_1", "u_dev_2", "u_prod_1"]
    }
  ],
  chat_eng_channel: [
    {
      id: "m4",
      chatId: "chat_eng_channel",
      senderId: "u_cto",
      body: "Reminder: production deploy freeze starts today at 20:00.",
      type: "text",
      priority: "important",
      createdAt: ago(170),
      status: "seen",
      seenByIds: ["u_amina", "u_dev_1", "u_qa_1"],
      deliveredToIds: ["u_dev_2", "u_intern_1"]
    },
    {
      id: "m5",
      chatId: "chat_eng_channel",
      senderId: "u_dev_1",
      body: "API latency for /conversations reduced by 32% after index optimization.",
      type: "text",
      priority: "normal",
      createdAt: ago(95),
      status: "seen",
      seenByIds: ["u_amina"],
      deliveredToIds: ["u_cto", "u_dev_2", "u_qa_1"]
    },
    {
      id: "m6",
      chatId: "chat_eng_channel",
      senderId: "u_qa_1",
      body: "Regression suite is green on staging. Sharing report.",
      type: "file",
      priority: "normal",
      createdAt: ago(61),
      status: "delivered",
      seenByIds: ["u_amina"],
      deliveredToIds: ["u_cto", "u_dev_1", "u_dev_2"],
      attachment: {
        id: "f_report_qa",
        name: "staging-regression-report.pdf",
        sizeLabel: "3.4 MB",
        mimeType: "application/pdf"
      }
    },
    {
      id: "m7",
      chatId: "chat_eng_channel",
      senderId: "u_dev_2",
      body: "I am preparing web split-pane refinements for desktop users.",
      type: "text",
      priority: "normal",
      createdAt: ago(20),
      status: "delivered",
      seenByIds: [],
      deliveredToIds: ["u_amina", "u_cto", "u_dev_1"]
    }
  ],
  chat_product_squad: [
    {
      id: "m8",
      chatId: "chat_product_squad",
      senderId: "u_prod_1",
      body: "Can we confirm final acceptance criteria for Sprint 24?",
      type: "text",
      priority: "important",
      createdAt: ago(240),
      status: "seen",
      seenByIds: ["u_amina", "u_des_1", "u_dev_2"],
      deliveredToIds: ["u_qa_1"]
    },
    {
      id: "m9",
      chatId: "chat_product_squad",
      senderId: "u_amina",
      body: "Approved. Engineering scope stays unchanged. QA sign-off by Thursday noon.",
      type: "text",
      priority: "normal",
      createdAt: ago(215),
      status: "seen",
      seenByIds: ["u_prod_1", "u_des_1"],
      deliveredToIds: ["u_dev_2", "u_qa_1"]
    }
  ],
  chat_dm_ceo: [
    {
      id: "m10",
      chatId: "chat_dm_ceo",
      senderId: "u_ceo",
      body: "Amina, can you share the hiring plan deck before 16:00?",
      type: "text",
      priority: "urgent",
      createdAt: ago(44),
      status: "delivered",
      seenByIds: [],
      deliveredToIds: ["u_amina"]
    }
  ],
  chat_dm_hr: [
    {
      id: "m11",
      chatId: "chat_dm_hr",
      senderId: "u_hr",
      body: "Interview panel for the senior frontend role is ready for your review.",
      type: "text",
      priority: "normal",
      createdAt: ago(380),
      status: "seen",
      seenByIds: ["u_amina"],
      deliveredToIds: []
    }
  ],
  chat_design_review: [
    {
      id: "m12",
      chatId: "chat_design_review",
      senderId: "u_des_1",
      body: "Attached refreshed sidebar and token system proposal.",
      type: "image",
      priority: "normal",
      createdAt: ago(502),
      status: "seen",
      seenByIds: ["u_amina", "u_prod_1"],
      deliveredToIds: ["u_dev_2"]
    }
  ],
  chat_ops_war_room: [
    {
      id: "m13",
      chatId: "chat_ops_war_room",
      senderId: "u_ops_1",
      body: "Incident #842 resolved. Postmortem scheduled tomorrow.",
      type: "text",
      priority: "important",
      createdAt: ago(910),
      status: "seen",
      seenByIds: ["u_amina"],
      deliveredToIds: ["u_dev_1", "u_qa_1"]
    }
  ],
  chat_sales_exec: [
    {
      id: "m14",
      chatId: "chat_sales_exec",
      senderId: "u_sales_1",
      body: "Enterprise client requested revised SLA and security annex.",
      type: "text",
      priority: "important",
      createdAt: ago(720),
      status: "seen",
      seenByIds: ["u_amina", "u_ceo"],
      deliveredToIds: []
    }
  ]
};

mockChats.forEach((chat) => {
  const messages = mockMessages[chat.id] ?? [];
  chat.lastMessageId = messages[messages.length - 1]?.id;
});

export const mockCallLogs: CallLogItem[] = [
  {
    id: "call_1",
    participantId: "u_cto",
    direction: "incoming",
    result: "answered",
    mode: "video",
    createdAt: ago(55),
    durationLabel: "24m"
  },
  {
    id: "call_2",
    participantId: "u_prod_1",
    direction: "outgoing",
    result: "missed",
    mode: "voice",
    createdAt: ago(200),
    durationLabel: "0m"
  },
  {
    id: "call_3",
    participantId: "u_dev_2",
    direction: "incoming",
    result: "answered",
    mode: "voice",
    createdAt: ago(600),
    durationLabel: "11m"
  }
];

export const mockSharedFiles: SharedFileItem[] = [
  {
    id: "sf_1",
    chatId: "chat_eng_channel",
    ownerId: "u_qa_1",
    title: "staging-regression-report.pdf",
    type: "document",
    sizeLabel: "3.4 MB",
    uploadedAt: ago(61)
  },
  {
    id: "sf_2",
    chatId: "chat_product_squad",
    ownerId: "u_prod_1",
    title: "Sprint-24-launch-plan.xlsx",
    type: "spreadsheet",
    sizeLabel: "1.2 MB",
    uploadedAt: ago(320)
  },
  {
    id: "sf_3",
    chatId: "chat_exec_announce",
    ownerId: "u_ceo",
    title: "Q2-org-communication.pptx",
    type: "presentation",
    sizeLabel: "8.7 MB",
    uploadedAt: ago(500)
  }
];
