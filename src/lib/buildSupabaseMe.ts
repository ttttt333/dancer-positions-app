import type { User } from "@supabase/supabase-js";
import type { Me } from "../types/authMe";
import {
  billingFieldsForMe,
  fetchChoreocoreBillingRow,
} from "./supabaseBilling";

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

/** 課金行をマージした Me（Supabase セッション確立後に呼ぶ） */
export async function buildMeFromSupabaseUserWithBilling(
  user: User
): Promise<Me> {
  const base = buildMeFromSupabaseUser(user);
  try {
    const billing = await fetchChoreocoreBillingRow();
    if (billing) {
      base.user = { ...base.user, ...billingFieldsForMe(billing) };
    }
  } catch {
    /* 課金テーブル未作成時もログインは継続 */
  }
  return base;
}
