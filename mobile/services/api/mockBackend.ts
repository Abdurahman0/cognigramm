import type {
  ApiCallSession,
  ApiConversation,
  ApiMessage,
  ApiUser
} from "@/services/api/types";

/**
 * A backend that lives inside the app.
 *
 * The web build runs against this instead of the network, so the UI can be opened and
 * driven with nothing else running. It is deliberately mutable: messages you send,
 * edits, reads, new conversations and profile changes all persist for the life of the
 * tab, which is what makes the app feel real rather than a screenshot.
 *
 * Sign-in accepts anything — this is a preview, not an auth system.
 */

const now = Date.now();
const ts = (minutesAgo: number): string => new Date(now - minutesAgo * 60_000).toISOString();
const avatar = (id: number): string => `https://i.pravatar.cc/240?img=${id}`;

const users: ApiUser[] = [
  {
    id: 1, username: "amir", email: "amir@company.uz", full_name: "Amir Karimov",
    avatar_url: avatar(12), role_id: 2, department_id: 1, title: "Engineering Manager",
    about: "Leading the platform team.", timezone: "Asia/Tashkent", phone: "+998 90 123 45 67",
    handle: "@amir", office_location: "Tashkent HQ · 4th floor", manager_id: null,
    last_seen_at: ts(0), status: "available", created_at: ts(60 * 24 * 400)
  },
  {
    id: 2, username: "nilufar", email: "nilufar@company.uz", full_name: "Nilufar Ahmedova",
    avatar_url: avatar(45), role_id: 3, department_id: 1, title: "Senior Backend Engineer",
    about: "Payments and messaging infrastructure.", timezone: "Asia/Tashkent",
    phone: "+998 90 222 11 09", handle: "@nilufar", office_location: "Tashkent HQ · 4th floor",
    manager_id: 1, last_seen_at: ts(2), status: "in_meeting", created_at: ts(60 * 24 * 300)
  },
  {
    id: 3, username: "jasur", email: "jasur@company.uz", full_name: "Jasur Tursunov",
    avatar_url: avatar(33), role_id: 3, department_id: 2, title: "Product Designer",
    about: "Design systems, motion, and the occasional icon.", timezone: "Asia/Tashkent",
    phone: "+998 91 700 40 10", handle: "@jasur", office_location: "Remote · Samarkand",
    manager_id: 1, last_seen_at: ts(14), status: "remote", created_at: ts(60 * 24 * 250)
  },
  {
    id: 4, username: "dilnoza", email: "dilnoza@company.uz", full_name: "Dilnoza Rasulova",
    avatar_url: avatar(24), role_id: 4, department_id: 3, title: "Head of People",
    about: "Hiring, onboarding, and everything in between.", timezone: "Asia/Tashkent",
    phone: "+998 93 501 22 33", handle: "@dilnoza", office_location: "Tashkent HQ · 2nd floor",
    manager_id: null, last_seen_at: ts(40), status: "busy", created_at: ts(60 * 24 * 500)
  },
  {
    id: 5, username: "sardor", email: "sardor@company.uz", full_name: "Sardor Yusupov",
    avatar_url: avatar(60), role_id: 3, department_id: 1, title: "Mobile Engineer",
    about: "React Native, gestures, and glass.", timezone: "Asia/Tashkent",
    phone: "+998 94 330 88 12", handle: "@sardor", office_location: "Tashkent HQ · 4th floor",
    manager_id: 1, last_seen_at: ts(6), status: "available", created_at: ts(60 * 24 * 180)
  },
  {
    id: 6, username: "malika", email: "malika@company.uz", full_name: "Malika Sobirova",
    avatar_url: avatar(31), role_id: 3, department_id: 4, title: "Data Analyst",
    about: "Dashboards, metrics, and weekly reports.", timezone: "Asia/Tashkent",
    phone: "+998 97 240 65 41", handle: "@malika", office_location: "Remote · Bukhara",
    manager_id: 4, last_seen_at: ts(90), status: "on_break", created_at: ts(60 * 24 * 120)
  },
  {
    id: 7, username: "bekzod", email: "bekzod@company.uz", full_name: "Bekzod Nazarov",
    avatar_url: avatar(52), role_id: 3, department_id: 2, title: "QA Engineer",
    about: "Breaking builds so users do not have to.", timezone: "Asia/Tashkent",
    phone: "+998 99 118 74 02", handle: "@bekzod", office_location: "Tashkent HQ · 3rd floor",
    manager_id: 1, last_seen_at: ts(300), status: "offline", created_at: ts(60 * 24 * 90)
  },
  {
    id: 8, username: "zilola", email: "zilola@company.uz", full_name: "Zilola Umarova",
    avatar_url: avatar(9), role_id: 2, department_id: 5, title: "Finance Lead",
    about: "Budgets, invoices, and quarterly planning.", timezone: "Asia/Tashkent",
    phone: "+998 90 887 30 55", handle: "@zilola", office_location: "Tashkent HQ · 2nd floor",
    manager_id: null, last_seen_at: ts(25), status: "available", created_at: ts(60 * 24 * 620)
  }
];

let currentUserId = 1;

const member = (userId: number, role: "admin" | "member" = "member", minutesAgo = 60 * 24 * 30) => ({
  user_id: userId,
  username: users.find((user) => user.id === userId)?.username ?? "unknown",
  role,
  joined_at: ts(minutesAgo)
});

const conversations: ApiConversation[] = [
  { id: 101, type: "direct", title: null, created_at: ts(60 * 24 * 60), participants: [member(1, "admin"), member(2)] },
  { id: 102, type: "group", title: "Platform Team", created_at: ts(60 * 24 * 120), participants: [member(1, "admin"), member(2), member(5), member(7)] },
  { id: 103, type: "direct", title: null, created_at: ts(60 * 24 * 40), participants: [member(1, "admin"), member(3)] },
  { id: 104, type: "group", title: "Design Review", created_at: ts(60 * 24 * 80), participants: [member(1, "admin"), member(3), member(5), member(2)] },
  { id: 105, type: "direct", title: null, created_at: ts(60 * 24 * 20), participants: [member(1, "admin"), member(4)] },
  { id: 106, type: "group", title: "Q3 Planning", created_at: ts(60 * 24 * 30), participants: [member(1, "admin"), member(4), member(6), member(8)] },
  { id: 107, type: "direct", title: null, created_at: ts(60 * 24 * 10), participants: [member(1, "admin"), member(5)] },
  { id: 108, type: "group", title: "Release 2.4", created_at: ts(60 * 24 * 6), participants: [member(1, "admin"), member(2), member(5), member(7), member(3)] }
];

let nextMessageId = 9000;
let nextConversationId = 200;

const message = (
  conversationId: number,
  senderId: number,
  content: string | null,
  minutesAgo: number,
  type: ApiMessage["message_type"] = "text",
  read = true
): ApiMessage => {
  nextMessageId += 1;
  const sender = users.find((user) => user.id === senderId);
  return {
    id: nextMessageId,
    conversation_id: conversationId,
    sender_id: senderId,
    sender: sender ? { id: sender.id, username: sender.username } : null,
    client_message_id: `seed-${nextMessageId}`,
    content,
    message_type: type,
    status: "sent",
    delivery_state: read ? "read" : "delivered",
    attachments: [],
    queued_at: ts(minutesAgo),
    persisted_at: ts(minutesAgo),
    delivered_at: ts(minutesAgo),
    read_at: read ? ts(minutesAgo) : null,
    delivery_updated_at: ts(minutesAgo),
    created_at: ts(minutesAgo),
    edited_at: null,
    deleted_at: null
  };
};

const withAttachment = (
  row: ApiMessage,
  name: string,
  mimeType: string,
  publicUrl: string,
  metadata: Record<string, unknown>
): ApiMessage => ({
  ...row,
  attachments: [
    {
      id: row.id,
      bucket: "mock",
      object_key: `mock/${name}`,
      original_name: name,
      mime_type: mimeType,
      size_bytes: 48_000,
      public_url: publicUrl,
      metadata_json: metadata,
      created_at: row.created_at
    }
  ]
});

const messagesByConversation: Record<number, ApiMessage[]> = {
  101: [
    message(101, 2, "Morning! Did the web build finish deploying?", 190),
    message(101, 1, "It did — went out about an hour ago.", 185),
    message(101, 2, "Nice. I saw the glass panels land, they look great on mobile.", 180),
    message(101, 1, "Thanks. The tab bar indicator was the fiddly part.", 176),
    message(101, 2, "Can you also check the notification stack on a small screen?", 40),
    message(101, 2, "No rush, whenever you get a minute.", 38, "text", false),
    withAttachment(
      message(101, 1, null, 30, "voice"),
      "note.m4a",
      "audio/mp4",
      "https://cdn.jsdelivr.net/gh/anars/blank-audio/10-seconds-of-silence.mp3",
      {
        duration_ms: 10_000,
        waveform: [22, 48, 35, 62, 41, 74, 39, 55, 28, 66, 44, 31, 58, 47, 70, 36, 52, 29, 61, 43, 38, 67, 33, 50, 25, 59, 42, 30]
      }
    ),
    withAttachment(
      message(101, 2, null, 22, "video_note"),
      "note.mp4",
      "video/mp4",
      "https://cdn.jsdelivr.net/gh/mediaelement/mediaelement-files/big_buck_bunny.mp4",
      { duration_ms: 12_000 }
    )
  ],
  102: [
    message(102, 5, "Pushed the gesture fix to main.", 320),
    message(102, 7, "Running the regression pass now.", 300),
    message(102, 2, "The switch drag feels much better after that change.", 290),
    message(102, 1, "Agreed. Let's keep the spring config in one place.", 285),
    message(102, 7, "Two flaky tests left, both timing related.", 120),
    message(102, 5, "I'll take those tomorrow morning.", 95, "text", false)
  ],
  103: [
    message(103, 3, "Sent over the updated motion spec.", 600),
    message(103, 1, "Looking at it now — the modal rise is exactly right.", 590),
    message(103, 3, "The parallax on the covered screen was the missing bit.", 585),
    message(103, 3, "Do you want me to mock the empty states too?", 60, "text", false)
  ],
  104: [
    message(104, 3, "Review deck is in the shared folder.", 1400),
    message(104, 2, "Left a couple of comments on slide 4.", 1300),
    message(104, 5, "Same, mostly about spacing on the list rows.", 1250),
    message(104, 1, "Let's walk through it on Thursday.", 1200)
  ],
  105: [
    message(105, 4, "Two candidates for the mobile role next week.", 800),
    message(105, 1, "Send the schedule and I'll block the time.", 780),
    message(105, 4, "Done — Tuesday and Wednesday afternoon.", 770)
  ],
  106: [
    message(106, 8, "Budget draft is ready for review.", 2000),
    message(106, 6, "I added the usage numbers from last quarter.", 1900),
    message(106, 4, "Headcount section still needs a pass.", 1850),
    message(106, 1, "I'll go through it before Friday.", 1800)
  ],
  107: [
    message(107, 5, "The blur intensity on Android looks a bit heavy.", 240),
    message(107, 1, "Try dropping the thick tier to 84.", 235),
    message(107, 5, "That did it, much closer to the web build.", 230),
    message(107, 5, "Want me to open a PR?", 45, "text", false)
  ],
  108: [
    message(108, 2, "Cutting the release branch this afternoon.", 500),
    message(108, 7, "QA sign-off is done except the calls screen.", 420),
    message(108, 3, "Icons are all updated in the asset bundle.", 400),
    message(108, 5, "Changelog is drafted.", 380),
    message(108, 1, "Great — let's ship Thursday.", 360)
  ]
};

const participant = (userId: number, state: string, minutesAgo: number, joined = true) => ({
  user_id: userId,
  state,
  is_online_when_invited: true,
  joined_at: joined ? ts(minutesAgo) : null,
  left_at: null,
  created_at: ts(minutesAgo)
});

const calls: ApiCallSession[] = [
  {
    id: "call-live", conversation_id: 101, initiator_id: 1, call_type: "video", state: "active",
    started_at: ts(3), ended_at: null, created_at: ts(3), updated_at: ts(0),
    participants: [participant(1, "joined", 3), participant(2, "joined", 3)]
  },
  {
    id: "call-ring", conversation_id: 103, initiator_id: 3, call_type: "audio", state: "ringing",
    started_at: null, ended_at: null, created_at: ts(0), updated_at: ts(0),
    participants: [participant(3, "ringing", 0, false), participant(1, "ringing", 0, false)]
  },
  {
    id: "call-out", conversation_id: 105, initiator_id: 1, call_type: "audio", state: "ringing",
    started_at: null, ended_at: null, created_at: ts(0), updated_at: ts(0),
    participants: [participant(1, "ringing", 0, false), participant(4, "ringing", 0, false)]
  },
  {
    id: "call-9001", conversation_id: 101, initiator_id: 2, call_type: "video", state: "ended",
    started_at: ts(200), ended_at: ts(178), created_at: ts(200), updated_at: ts(178),
    participants: [participant(2, "joined", 200), participant(1, "joined", 199)]
  },
  {
    id: "call-9002", conversation_id: 102, initiator_id: 1, call_type: "audio", state: "ended",
    started_at: ts(1500), ended_at: ts(1462), created_at: ts(1500), updated_at: ts(1462),
    participants: [participant(1, "joined", 1500), participant(5, "joined", 1498)]
  },
  {
    id: "call-9003", conversation_id: 103, initiator_id: 3, call_type: "audio", state: "missed",
    started_at: null, ended_at: ts(2800), created_at: ts(2805), updated_at: ts(2800),
    participants: [participant(3, "ringing", 2805, false), participant(1, "missed", 2805, false)]
  }
];

const onlineUserIds = [1, 2, 3, 5, 8];

export class MockNotFoundError extends Error {}

interface MockRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  body: Record<string, unknown>;
}

const findUser = (id: number): ApiUser | undefined => users.find((user) => user.id === id);

/**
 * Serves one request. Anything unrecognised throws, so a route that quietly went missing
 * surfaces as an error rather than an empty screen.
 */
export const handleMockRequest = ({ method, path, query, body }: MockRequest): unknown => {
  const match = (pattern: RegExp): RegExpMatchArray | null => path.match(pattern);

  if (method === "POST" && path === "/auth/login") {
    // Any credentials are accepted: this is a preview, not an auth system. Signing in as
    // a seeded address picks that person, so the conversation perspective can be swapped.
    const identifier = String(body.identifier ?? "").trim().toLowerCase();
    const known = users.find(
      (user) => user.email.toLowerCase() === identifier || user.username.toLowerCase() === identifier
    );
    currentUserId = known?.id ?? 1;
    return { access_token: `mock-token-${currentUserId}`, token_type: "bearer" };
  }

  if (method === "POST" && path === "/auth/register") {
    const created: ApiUser = {
      ...users[0]!,
      id: Math.max(...users.map((user) => user.id)) + 1,
      username: String(body.username ?? "new"),
      email: String(body.email ?? "new@company.uz"),
      full_name: String(body.username ?? "New User"),
      avatar_url: null,
      title: "New joiner",
      about: null,
      status: "available",
      created_at: ts(0)
    };
    users.push(created);
    currentUserId = created.id;
    return created;
  }

  if (path === "/users/me") {
    const self = findUser(currentUserId);
    if (method === "PATCH" && self) {
      Object.entries(body).forEach(([key, value]) => {
        if (key in self) {
          (self as unknown as Record<string, unknown>)[key] = value;
        }
      });
    }
    return self;
  }

  if (method === "GET" && path === "/users") {
    const term = (query.q ?? "").trim().toLowerCase();
    const includeSelf = query.include_self === "true";
    return users
      .filter((user) => includeSelf || user.id !== currentUserId)
      .filter((user) =>
        term.length === 0 ||
        [user.full_name, user.username, user.title, user.email]
          .some((field) => (field ?? "").toLowerCase().includes(term))
      );
  }

  if (path === "/conversations") {
    if (method === "GET") {
      return conversations;
    }
    if (method === "POST") {
      nextConversationId += 1;
      const ids = [currentUserId, ...((body.participant_ids as number[] | undefined) ?? [])];
      const created: ApiConversation = {
        id: nextConversationId,
        type: (body.type as ApiConversation["type"]) ?? "direct",
        title: (body.title as string | undefined) ?? null,
        created_at: ts(0),
        participants: Array.from(new Set(ids)).map((id) =>
          member(id, id === currentUserId ? "admin" : "member", 0)
        )
      };
      conversations.unshift(created);
      messagesByConversation[created.id] = [];
      return created;
    }
  }

  let hit = match(/^\/conversations\/(\d+)$/);
  if (hit && method === "GET") {
    return conversations.find((row) => row.id === Number(hit![1]));
  }

  hit = match(/^\/conversations\/(\d+)\/messages$/);
  if (hit && method === "GET") {
    return messagesByConversation[Number(hit[1])] ?? [];
  }

  hit = match(/^\/conversations\/(\d+)\/messages\/latest$/);
  if (hit && method === "GET") {
    const rows = messagesByConversation[Number(hit[1])] ?? [];
    return rows.length > 0 ? rows[rows.length - 1] : null;
  }

  hit = match(/^\/conversations\/(\d+)\/members$/);
  if (hit && method === "POST") {
    const conversation = conversations.find((row) => row.id === Number(hit![1]));
    const ids = (body.user_ids as number[] | undefined) ?? [body.user_id as number];
    ids.filter(Boolean).forEach((id) => {
      if (conversation && !conversation.participants.some((row) => row.user_id === id)) {
        conversation.participants.push(member(id, "member", 0));
      }
    });
    return conversation;
  }

  hit = match(/^\/conversations\/(\d+)\/members\/(\d+)$/);
  if (hit && method === "DELETE") {
    const conversation = conversations.find((row) => row.id === Number(hit![1]));
    if (conversation) {
      conversation.participants = conversation.participants.filter(
        (row) => row.user_id !== Number(hit![2])
      );
    }
    return conversation;
  }

  if (method === "POST" && path === "/messages") {
    const conversationId = Number(body.conversation_id);
    nextMessageId += 1;
    const self = findUser(currentUserId);
    const row: ApiMessage = {
      id: nextMessageId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      sender: self ? { id: self.id, username: self.username } : null,
      client_message_id: String(body.client_message_id ?? `c-${nextMessageId}`),
      content: (body.content as string | null) ?? null,
      message_type: (body.type as ApiMessage["message_type"]) ?? "text",
      status: "sent",
      delivery_state: "delivered",
      attachments: (body.attachments as ApiMessage["attachments"]) ?? [],
      queued_at: ts(0),
      persisted_at: ts(0),
      delivered_at: ts(0),
      read_at: null,
      delivery_updated_at: ts(0),
      created_at: ts(0),
      edited_at: null,
      deleted_at: null
    };
    messagesByConversation[conversationId] = [
      ...(messagesByConversation[conversationId] ?? []),
      row
    ];
    return row;
  }

  hit = match(/^\/messages\/(\d+)$/);
  if (hit) {
    const id = Number(hit[1]);
    for (const rows of Object.values(messagesByConversation)) {
      const row = rows.find((entry) => entry.id === id);
      if (!row) {
        continue;
      }
      if (method === "PATCH") {
        row.content = (body.content as string | null) ?? row.content;
        row.edited_at = ts(0);
      }
      if (method === "DELETE") {
        row.deleted_at = ts(0);
        row.content = null;
      }
      return row;
    }
    throw new MockNotFoundError(`No message ${id}`);
  }

  if (match(/^\/messages\/(\d+)\/read$/) && method === "POST") {
    return null;
  }

  if (method === "GET" && path === "/presence/users/online") {
    return onlineUserIds;
  }

  hit = match(/^\/presence\/users\/(\d+)$/);
  if (hit && method === "GET") {
    const id = Number(hit[1]);
    return {
      user_id: id,
      is_online: onlineUserIds.includes(id),
      active_conversation_id: null,
      sessions: onlineUserIds.includes(id) ? 1 : 0,
      last_seen: findUser(id)?.last_seen_at ?? null,
      updated_at: ts(0)
    };
  }

  if (path === "/presence/active-conversation") {
    return {
      user_id: currentUserId,
      is_online: true,
      active_conversation_id: (body.conversation_id as number | undefined) ?? null,
      sessions: 1,
      last_seen: ts(0),
      updated_at: ts(0)
    };
  }

  if (method === "GET" && path === "/calls/history") {
    return { total: calls.length, calls };
  }

  hit = match(/^\/calls\/([^/]+)$/);
  if (hit && method === "GET") {
    return calls.find((row) => row.id === hit![1]);
  }

  if (method === "POST" && (path === "/files/presign" || path === "/files/upload-local")) {
    return {
      upload_url: "mock://upload",
      bucket: "mock",
      object_key: `mock/${String(body.filename ?? "file")}`,
      original_name: String(body.filename ?? "file"),
      mime_type: String(body.content_type ?? "application/octet-stream"),
      size_bytes: Number(body.size_bytes ?? 0),
      expires_in: 3600,
      content_type: String(body.content_type ?? ""),
      public_url: null
    };
  }

  throw new MockNotFoundError(`No mock route for ${method} ${path}`);
};
