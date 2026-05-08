import type { Me } from "../types/authMe";
import type { User } from "@supabase/supabase-js";

export function buildMeFromSupabaseUser(user: User | null | undefined): Me {
  if (!user) {
    return {
      user: { id: "", email: "" },
      adminOrganizations: [],
      memberOrganizations: [],
    };
  }
  return {
    user: {
      id: user.id,
      email: user.email ?? "",
    },
    adminOrganizations: [],
    memberOrganizations: [],
  };
}
