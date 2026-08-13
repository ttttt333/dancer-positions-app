/**
 * 世界向けリリースキャンペーン
 * true のあいだは全ユーザーに PRO 相当機能を開放する。
 * 終了時は ACTIVE を false にし、migration 017 を down する。
 */

export const RELEASE_CAMPAIGN_ACTIVE = true;

/** 表示用（キャンペーン終了予定の目安。課金再開日ではない） */
export const RELEASE_CAMPAIGN_LABEL = "Global Launch";

export function isReleaseCampaignActive(): boolean {
  return RELEASE_CAMPAIGN_ACTIVE;
}
