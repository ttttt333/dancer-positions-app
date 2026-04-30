export type Me = {
  user: {
    id: string;
    email: string;
    entitlement_lifetime?: number;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    subscription_status?: string | null;
  };
  adminOrganizations: { id: number; name: string }[];
  memberOrganizations: { id: number; name: string }[];
};
