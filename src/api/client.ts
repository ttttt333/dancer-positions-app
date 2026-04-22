const base = "";

export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("auth_token", token);
  else localStorage.removeItem("auth_token");
}

async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers as object),
  };
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data.error || res.statusText || "API error");
  }
  return data as T;
}

/** 認証付きでバイナリを取得し、`blob:` URL を返す（呼び出し側で revoke 推奨） */
export async function fetchAuthorizedAudioBlobUrl(assetId: number): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("ログインが必要です");
  const res = await fetch(`${base}/api/audio/${assetId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text();
    let msg = res.statusText;
    try {
      msg = JSON.parse(t).error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export const authApi = {
  register: (email: string, password: string) =>
    api<{ token: string; user: { id: number; email: string } }>(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  login: (email: string, password: string) =>
    api<{ token: string; user: { id: number; email: string } }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  me: () =>
    api<{
      user: {
        id: number;
        email: string;
        entitlement_lifetime?: number;
        stripe_customer_id?: string | null;
        stripe_subscription_id?: string | null;
        subscription_status?: string | null;
      };
      adminOrganizations: { id: number; name: string }[];
      memberOrganizations: { id: number; name: string }[];
    }>("/api/auth/me"),
};

export const projectApi = {
  list: () =>
    api<{ id: number; name: string; updated_at: string }[]>("/api/projects"),
  get: (id: number) =>
    api<{ id: number; name: string; json: unknown; updated_at: string }>(
      `/api/projects/${id}`
    ),
  create: (name: string, json: unknown) =>
    api<{ id: number; name: string; updated_at: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, json }),
    }),
  update: (id: number, name: string, json: unknown) =>
    api<{ id: number; name: string; updated_at: string }>(
      `/api/projects/${id}`,
      { method: "PUT", body: JSON.stringify({ name, json }) }
    ),
  remove: (id: number) =>
    api<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
  /** オーナーのみ。メールで協作者を追加 */
  addCollaborator: (projectId: number, email: string) =>
    api<{ ok: boolean; userId: number }>(
      `/api/projects/${projectId}/collaborators`,
      { method: "POST", body: JSON.stringify({ email }) }
    ),
};

export async function audioApiUpload(formData: FormData): Promise<{ id: number; mime: string }> {
  const token = getToken();
  if (!token) throw new Error("ログインが必要です");
  const res = await fetch(`${base}/api/audio/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || res.statusText || "アップロード失敗");
  return data as { id: number; mime: string };
}

export const billingApi = {
  /** Stripe Checkout（サブスク）。レスポンスの url へリダイレクト */
  createCheckoutSession: () =>
    api<{ url: string }>("/api/billing/create-checkout-session", {
      method: "POST",
      body: "{}",
    }),
  placeholderPurchase: () =>
    api<{ ok: boolean; message?: string }>("/api/billing/placeholder-purchase", {
      method: "POST",
      body: "{}",
    }),
};
