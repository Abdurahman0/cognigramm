import type { ID } from "@/types";

export interface EmployeeMeta {
  handle: string;
  phone?: string;
  officeLocation: string;
  managerId?: ID;
  joinedAt: string;
}

export interface ConversationMeta {
  createdAt: string;
  createdById: ID;
  teamType?: string;
  postingPolicy?: string;
}

export const employeeMetaById: Record<string, EmployeeMeta> = {
  u_amina: {
    handle: "@amina_rahimova",
    phone: "+998 90 112 4401",
    officeLocation: "Tashkent HQ",
    managerId: "u_cto",
    joinedAt: "2022-03-14T09:00:00.000Z"
  },
  u_ceo: {
    handle: "@daniel_foster",
    phone: "+44 20 3880 0192",
    officeLocation: "London Office",
    joinedAt: "2019-01-07T09:00:00.000Z"
  },
  u_cto: {
    handle: "@sardor_karimov",
    phone: "+998 90 221 0638",
    officeLocation: "Tashkent HQ",
    managerId: "u_ceo",
    joinedAt: "2019-07-02T09:00:00.000Z"
  },
  u_hr: {
    handle: "@madina_hr",
    phone: "+998 90 553 0271",
    officeLocation: "Tashkent HQ",
    managerId: "u_ceo",
    joinedAt: "2021-02-11T09:00:00.000Z"
  },
  u_dev_1: {
    handle: "@bekzod_backend",
    phone: "+998 90 700 1136",
    officeLocation: "Remote - Tashkent",
    managerId: "u_amina",
    joinedAt: "2022-11-03T09:00:00.000Z"
  },
  u_dev_2: {
    handle: "@nargiza_frontend",
    phone: "+998 90 441 2920",
    officeLocation: "Tashkent HQ",
    managerId: "u_amina",
    joinedAt: "2023-01-16T09:00:00.000Z"
  },
  u_des_1: {
    handle: "@umidjon_design",
    officeLocation: "Tashkent HQ",
    managerId: "u_prod_1",
    joinedAt: "2021-08-18T09:00:00.000Z"
  },
  u_prod_1: {
    handle: "@dilnoza_product",
    phone: "+998 90 880 5409",
    officeLocation: "Remote - Samarkand",
    managerId: "u_ceo",
    joinedAt: "2020-06-09T09:00:00.000Z"
  },
  u_qa_1: {
    handle: "@shukhrat_qa",
    officeLocation: "Tashkent HQ",
    managerId: "u_amina",
    joinedAt: "2023-04-24T09:00:00.000Z"
  },
  u_ops_1: {
    handle: "@akmal_ops",
    phone: "+998 90 319 7704",
    officeLocation: "Tashkent HQ",
    managerId: "u_ceo",
    joinedAt: "2020-10-01T09:00:00.000Z"
  },
  u_sales_1: {
    handle: "@aziza_sales",
    phone: "+998 90 290 6020",
    officeLocation: "Remote - Dubai",
    managerId: "u_ceo",
    joinedAt: "2022-09-19T09:00:00.000Z"
  },
  u_intern_1: {
    handle: "@jahongir_intern",
    officeLocation: "Tashkent HQ",
    managerId: "u_amina",
    joinedAt: "2025-01-13T09:00:00.000Z"
  }
};

export const conversationMetaById: Record<string, ConversationMeta> = {
  chat_exec_announce: {
    createdAt: "2021-04-05T09:00:00.000Z",
    createdById: "u_ceo",
    teamType: "Leadership",
    postingPolicy: "Only leadership and HR can post announcements."
  },
  chat_eng_channel: {
    createdAt: "2021-09-14T09:00:00.000Z",
    createdById: "u_cto",
    teamType: "Department Channel",
    postingPolicy: "All engineering members can publish updates."
  },
  chat_product_squad: {
    createdAt: "2024-02-12T09:00:00.000Z",
    createdById: "u_prod_1",
    teamType: "Project Group",
    postingPolicy: "Team members collaborate openly in this group."
  },
  chat_dm_ceo: {
    createdAt: "2023-07-17T09:00:00.000Z",
    createdById: "u_ceo"
  },
  chat_dm_hr: {
    createdAt: "2023-11-06T09:00:00.000Z",
    createdById: "u_hr"
  },
  chat_design_review: {
    createdAt: "2022-10-20T09:00:00.000Z",
    createdById: "u_des_1",
    teamType: "Design Council",
    postingPolicy: "Design proposals are reviewed weekly by board members."
  },
  chat_ops_war_room: {
    createdAt: "2022-12-15T09:00:00.000Z",
    createdById: "u_ops_1",
    teamType: "Incident Channel",
    postingPolicy: "Incident commander controls pinned updates."
  },
  chat_sales_exec: {
    createdAt: "2023-05-29T09:00:00.000Z",
    createdById: "u_sales_1",
    teamType: "Executive Sync",
    postingPolicy: "Restricted to sales leadership and executive members."
  }
};
