import { useCallback, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  isVideoExportLimitReached,
  remainingVideoExports,
} from "../lib/entitlements";
import {
  assertVideoExportAllowed,
  VideoExportLimitError,
} from "../lib/videoExportAllowance";
import { ProUpgradeModal } from "../components/ProUpgradeModal";

/** 動画書き出しボタン向け: 残り回数表示 + サーバー側チェック + アップグレードモーダル */
export function useVideoExportGate() {
  const { me, refresh } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const remaining = remainingVideoExports(me);
  const limitReached = isVideoExportLimitReached(me);

  const gateBeforeExport = useCallback(async (): Promise<boolean> => {
    if (limitReached) {
      setUpgradeOpen(true);
      return false;
    }
    try {
      await assertVideoExportAllowed();
      void refresh();
      return true;
    } catch (e) {
      if (e instanceof VideoExportLimitError) {
        setUpgradeOpen(true);
        return false;
      }
      throw e;
    }
  }, [limitReached, refresh]);

  const openUpgradeIfNeeded = useCallback(() => {
    if (limitReached) {
      setUpgradeOpen(true);
      return true;
    }
    return false;
  }, [limitReached]);

  const upgradeModal = (
    <ProUpgradeModal
      open={upgradeOpen}
      reason="export_limit_reached"
      onClose={() => setUpgradeOpen(false)}
    />
  );

  return {
    remaining,
    limitReached,
    gateBeforeExport,
    openUpgradeIfNeeded,
    upgradeModal,
  };
}
