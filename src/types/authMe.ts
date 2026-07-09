export type Me = {
  user: {
    id: string;
    email: string;
    entitlement_lifetime?: number;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    subscription_status?: string | null;
    /** 累計動画書き出し回数（FREE 上限判定用） */
    video_export_count?: number;
    /** DB の choreocore_is_pro_me()（Stripe / lifetime / 付与を含む） */
    is_pro?: boolean;
  };
  adminOrganizations: { id: number; name: string }[];
  memberOrganizations: { id: number; name: string }[];
};
