export * from "./database.generated";

import type { Enums, Tables } from "./database.generated";

export type Profile = Tables<"profiles">;
export type Committee = Tables<"committees">;
export type CommitteeRole = Tables<"committee_roles">;
export type AccountStatus = Enums<"account_status">;
export type PersonCategory = Enums<"person_category">;
export type GlobalRole = string;
export type CommitteeStatus = Enums<"committee_status">;
export type AccessLevel = Enums<"committee_access_level">;
export type MeetingStatus = Enums<"meeting_status">;
export type ActionPriority = Enums<"action_priority">;
