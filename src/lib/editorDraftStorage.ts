import type { ChoreographyProjectJson } from "../types/choreography";
import { safeGetItem, safeRemoveItem, safeSetItem } from "../utils/storage";

const DRAFT_KEY_PREFIX = "choreogrid-editor-draft-v1:";

export type EditorDraftEnvelope = {
  savedAt: string;
  serverId: number | null;
  projectName: string;
  project: ChoreographyProjectJson;
};

function draftKey(serverId: number | null): string {
  return `${DRAFT_KEY_PREFIX}${serverId ?? "new"}`;
}

export function saveEditorDraft(envelope: EditorDraftEnvelope): void {
  safeSetItem(draftKey(envelope.serverId), envelope);
}

export function loadEditorDraft(
  serverId: number | null
): EditorDraftEnvelope | null {
  return safeGetItem<EditorDraftEnvelope>(draftKey(serverId));
}

export function clearEditorDraft(serverId: number | null): void {
  safeRemoveItem(draftKey(serverId));
}
