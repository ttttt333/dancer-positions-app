import { getSupabase, isSupabaseBackend } from "./supabaseClient";
import { APP_LOCALES, isAppLocale, type AppLocale } from "../i18n/types";

export type UpdateLogBodies = Partial<Record<AppLocale, string>>;

export type UpdateLogDoc = {
  body: string;
  bodies: UpdateLogBodies;
  updatedAt: string | null;
  canEdit: boolean;
  /** supabase / local / default */
  source: "supabase" | "local" | "default";
};

const LOCAL_KEY = "choreocore_update_log_v1";

export const DEFAULT_UPDATE_LOG_BODY = `# ChoreoCore アップデートログ

アプリのバージョンアップや修正内容をここに掲載します。

## 使い方
- 全員: このページで最新の状況を確認できます
- 管理人: 「編集」を押して文章を書き、「更新する」で保存できます

## 最近の更新
- （ここに追記してください）
`;

const DEFAULT_UPDATE_LOG_BODIES: Record<AppLocale, string> = {
  ja: DEFAULT_UPDATE_LOG_BODY,
  en: `# ChoreoCore update log

Version updates and fixes are posted here.

## How to use
- Everyone: check the latest notes on this page
- Admins: tap Edit, write the notes in Japanese, then Publish. Other languages are translated automatically.

## Recent updates
- (Add notes here)
`,
  ko: `# ChoreoCore 업데이트 로그

앱 버전 업데이트와 수정 내용을 여기에 게시합니다.

## 사용 방법
- 모두: 이 페이지에서 최신 소식을 확인할 수 있습니다
- 관리자: 편집을 눌러 일본어로 작성한 뒤 게시를 누르면 다른 언어로 자동 번역됩니다

## 최근 업데이트
- (여기에 추가하세요)
`,
  zh: `# ChoreoCore 更新日志

应用版本更新与修复内容会发布在这里。

## 使用方法
- 所有人：可在此页查看最新说明
- 管理员：点“编辑”用日文撰写，再点“发布”。其他语言会自动翻译。

## 最近更新
- （请在此补充）
`,
  es: `# Registro de actualizaciones de ChoreoCore

Aquí se publican versiones y correcciones.

## Cómo usarlo
- Todos: consulten las novedades en esta página
- Administradores: pulsen Editar, escriban en japonés y Publiquen. El resto de idiomas se traduce automáticamente.

## Novedades recientes
- (Añadir notas aquí)
`,
  fr: `# Journal des mises à jour ChoreoCore

Les versions et corrections sont publiées ici.

## Mode d’emploi
- Tout le monde : consultez les notes sur cette page
- Admins : appuyez sur Modifier, rédigez en japonais, puis Publier. Les autres langues sont traduites automatiquement.

## Mises à jour récentes
- (Ajouter des notes ici)
`,
  de: `# ChoreoCore-Updateprotokoll

Versionen und Korrekturen stehen hier.

## So geht’s
- Alle: aktuelle Hinweise auf dieser Seite prüfen
- Admins: Bearbeiten, auf Japanisch schreiben, dann Veröffentlichen. Andere Sprachen werden automatisch übersetzt.

## Aktuelle Updates
- (Hier ergänzen)
`,
  pt: `# Registro de atualizações do ChoreoCore

Versões e correções são publicadas aqui.

## Como usar
- Todos: vejam as novidades nesta página
- Administradores: toquem em Editar, escrevam em japonês e Publiquem. Os outros idiomas são traduzidos automaticamente.

## Atualizações recentes
- (Adicionar notas aqui)
`,
};

function parseAdminEmailsFromEnv(): string[] {
  const raw = String(import.meta.env.VITE_CHOREOCORE_ADMIN_EMAILS ?? "");
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** 編集 UI を出すか（保存権限はサーバ側 RPC が最終判定） */
export function canShowUpdateLogEditor(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  const admins = parseAdminEmailsFromEnv();
  const normalized = email.trim().toLowerCase();
  if (admins.length > 0) return admins.includes(normalized);
  // env 未設定時: 開発ビルドのみログインユーザーに編集 UI を出す
  return Boolean(import.meta.env.DEV);
}

export function parseUpdateLogBodies(raw: unknown): UpdateLogBodies {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: UpdateLogBodies = {};
  for (const loc of APP_LOCALES) {
    const v = o[loc];
    if (typeof v === "string" && v.trim()) out[loc] = v;
  }
  return out;
}

export function pickUpdateLogBody(doc: UpdateLogDoc, locale: AppLocale): string {
  const bodies = doc.bodies ?? {};
  const localized = bodies[locale]?.trim();
  if (localized) return bodies[locale]!;
  const ja = bodies.ja?.trim();
  if (ja) return bodies.ja!;
  return doc.body?.trim() ? doc.body : "";
}

export function updateLogSourceDraft(doc: UpdateLogDoc | null): string {
  if (!doc) return DEFAULT_UPDATE_LOG_BODY;
  return doc.bodies.ja?.trim() || doc.body || DEFAULT_UPDATE_LOG_BODY;
}

const DATE_LOCALE: Record<AppLocale, string> = {
  ja: "ja-JP",
  en: "en-US",
  ko: "ko-KR",
  zh: "zh-CN",
  es: "es",
  fr: "fr",
  de: "de",
  pt: "pt-BR",
};

function readLocalDoc(): UpdateLogDoc | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      body?: unknown;
      bodies?: unknown;
      updatedAt?: unknown;
    };
    if (typeof parsed.body !== "string") return null;
    const bodies = parseUpdateLogBodies(parsed.bodies);
    if (!bodies.ja && parsed.body.trim()) bodies.ja = parsed.body;
    return {
      body: parsed.body,
      bodies,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      canEdit: false,
      source: "local",
    };
  } catch {
    return null;
  }
}

function writeLocalDoc(body: string, bodies: UpdateLogBodies): UpdateLogDoc {
  const updatedAt = new Date().toISOString();
  const nextBodies: UpdateLogBodies = { ...bodies, ja: body };
  localStorage.setItem(
    LOCAL_KEY,
    JSON.stringify({ body, bodies: nextBodies, updatedAt })
  );
  return { body, bodies: nextBodies, updatedAt, canEdit: true, source: "local" };
}

function parseRpcPayload(
  data: unknown,
  source: UpdateLogDoc["source"]
): UpdateLogDoc | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.body !== "string") return null;
  const bodies = parseUpdateLogBodies(o.bodies);
  if (!bodies.ja && o.body.trim()) bodies.ja = o.body;
  return {
    body: o.body,
    bodies,
    updatedAt:
      typeof o.updatedAt === "string"
        ? o.updatedAt
        : o.updatedAt != null
          ? String(o.updatedAt)
          : null,
    canEdit: o.canEdit === true,
    source,
  };
}

function defaultDoc(canEdit: boolean): UpdateLogDoc {
  return {
    body: DEFAULT_UPDATE_LOG_BODY,
    bodies: { ...DEFAULT_UPDATE_LOG_BODIES },
    updatedAt: null,
    canEdit,
    source: "default",
  };
}

export async function fetchUpdateLog(
  viewerEmail?: string | null
): Promise<UpdateLogDoc> {
  const showEditor = canShowUpdateLogEditor(viewerEmail);

  if (isSupabaseBackend()) {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.rpc("choreocore_get_update_log");
      if (!error) {
        const doc = parseRpcPayload(data, "supabase");
        if (doc) {
          const empty =
            !doc.body.trim() &&
            !Object.values(doc.bodies).some((v) => (v ?? "").trim());
          if (empty) return { ...defaultDoc(doc.canEdit || showEditor) };
          return {
            ...doc,
            canEdit: doc.canEdit || showEditor,
          };
        }
      }
    } catch {
      /* fall through */
    }
  }

  const local = readLocalDoc();
  if (local) {
    return { ...local, canEdit: showEditor };
  }

  return defaultDoc(showEditor);
}

export async function saveUpdateLog(
  body: string,
  viewerEmail?: string | null,
  bodies: UpdateLogBodies = {}
): Promise<UpdateLogDoc> {
  if (!canShowUpdateLogEditor(viewerEmail)) {
    throw new Error("管理者権限がありません");
  }

  const nextBodies: UpdateLogBodies = { ...bodies, ja: body };

  if (isSupabaseBackend()) {
    try {
      const sb = getSupabase();
      let { data, error } = await sb.rpc("choreocore_save_update_log", {
        p_body: body,
        p_bodies: nextBodies,
      });
      if (
        error &&
        /p_bodies|could not find the function|schema cache/i.test(error.message)
      ) {
        ({ data, error } = await sb.rpc("choreocore_save_update_log", {
          p_body: body,
        }));
      }
      if (!error) {
        const doc = parseRpcPayload(data, "supabase");
        if (doc) {
          return {
            ...doc,
            bodies:
              Object.keys(doc.bodies).length > 0 ? doc.bodies : nextBodies,
            canEdit: true,
          };
        }
      }
      if (error) {
        const msg = error.message || "";
        if (!/permission|権限|管理者|ログイン/i.test(msg)) {
          return writeLocalDoc(body, nextBodies);
        }
        throw new Error(msg);
      }
    } catch (e) {
      if (e instanceof Error && /権限|ログイン|管理者/.test(e.message)) {
        throw e;
      }
      return writeLocalDoc(body, nextBodies);
    }
  }

  return writeLocalDoc(body, nextBodies);
}

export function formatUpdateLogUpdatedAt(
  iso: string | null,
  locale: AppLocale | string = "ja"
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const tag = isAppLocale(locale) ? DATE_LOCALE[locale] : locale;
  return d.toLocaleString(tag, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
