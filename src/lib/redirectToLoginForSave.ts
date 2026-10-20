import type { NavigateFunction } from "react-router-dom";
import type { ChoreographyProjectJson } from "../types/choreography";
import { saveEditorDraft } from "./editorDraftStorage";
import {
  stashPostLoginRedirect,
  stashSaveIntentAfterLogin,
} from "./postLoginRedirect";

/**
 * 未ログインで保存しようとしたとき: 下書きを残してログインへ送る。
 * ログイン後は元の編集画面に戻り、保存意図フラグでクラウド保存を続行できる。
 */
export function redirectToLoginForSave(opts: {
  navigate: NavigateFunction;
  project: ChoreographyProjectJson;
  projectName: string;
  serverId: number | null;
  returnPath?: string;
}): void {
  const {
    navigate,
    project,
    projectName,
    serverId,
    returnPath =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/editor/new",
  } = opts;

  try {
    saveEditorDraft({
      savedAt: new Date().toISOString(),
      serverId,
      projectName:
        projectName.trim() || project.pieceTitle?.trim() || "無題の作品",
      project,
    });
  } catch {
    /* 下書き失敗でもログインへ進む */
  }

  stashPostLoginRedirect(returnPath);
  stashSaveIntentAfterLogin();
  navigate("/login", { state: { from: returnPath } });
}
