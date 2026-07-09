import { useMemo } from 'react'
import { useMobileShellBridgeStore } from '../../store/useMobileShellBridgeStore'

export type MobileMenuItem = {
  label: string
  icon: string
  action: () => void
}

export type MobileMenuSection = {
  title: string
  items: MobileMenuItem[]
}

/** PortraitBottomBar / LandscapeSidePanel 共通のメニュー構成 */
export function useMobileMenuSections(): MobileMenuSection[] {
  const onSaveSpot = useMobileShellBridgeStore((s) => s.onSaveSpot)
  const onAddText = useMobileShellBridgeStore((s) => s.onAddText)
  const onCueList = useMobileShellBridgeStore((s) => s.onCueList)
  const onStageShape = useMobileShellBridgeStore((s) => s.onStageShape)
  const onSetPiece = useMobileShellBridgeStore((s) => s.onSetPiece)
  const onAudioImport = useMobileShellBridgeStore((s) => s.onAudioImport)
  const onAiSuggest = useMobileShellBridgeStore((s) => s.onAiSuggest)
  const onRosterImport = useMobileShellBridgeStore((s) => s.onRosterImport)
  const onMemberList = useMobileShellBridgeStore((s) => s.onMemberList)
  const onMemberAdd = useMobileShellBridgeStore((s) => s.onMemberAdd)
  const onShareLinks = useMobileShellBridgeStore((s) => s.onShareLinks)
  const onHelp = useMobileShellBridgeStore((s) => s.onHelp)
  const onVideoExport = useMobileShellBridgeStore((s) => s.onVideoExport)
  const onFlowLibrary = useMobileShellBridgeStore((s) => s.onFlowLibrary)
  const onPhotoParse = useMobileShellBridgeStore((s) => s.onPhotoParse)
  const onAddCue = useMobileShellBridgeStore((s) => s.onAddCue)
  const onStageSettings = useMobileShellBridgeStore((s) => s.onStageSettings)
  const onViewerList = useMobileShellBridgeStore((s) => s.onViewerList)

  return useMemo(
    () => [
      {
        title: 'Stages',
        items: [
          { label: 'キュー設定', icon: '🎬', action: onAddCue },
          { label: '舞台設定', icon: '⚙️', action: onStageSettings },
          { label: 'キュー一覧', icon: '📋', action: onCueList },
          { label: 'ライブラリ', icon: '📚', action: onFlowLibrary },
          { label: '画像キュー', icon: '🖼️', action: onPhotoParse },
          { label: '雛形保存', icon: '💾', action: onSaveSpot },
          { label: 'テキスト', icon: '✏️', action: onAddText },
          { label: '舞台変形', icon: '🏟️', action: onStageShape },
          { label: '大道具', icon: '🪑', action: onSetPiece },
        ],
      },
      {
        title: 'Timeline',
        items: [
          { label: '音源追加', icon: '🎵', action: onAudioImport },
          { label: 'AI提案', icon: '✨', action: onAiSuggest },
          { label: '名簿取込', icon: '📄', action: onRosterImport },
        ],
      },
      {
        title: 'Team',
        items: [
          { label: 'メンバー', icon: '👤', action: onMemberList },
          { label: '追加', icon: '➕', action: onMemberAdd },
          { label: '共有', icon: '🔗', action: onShareLinks },
        ],
      },
      {
        title: 'Settings',
        items: [
          { label: 'エクスポート', icon: '📤', action: onViewerList },
          { label: '動画書出', icon: '🎥', action: onVideoExport },
          { label: 'ヘルプ', icon: '❓', action: onHelp },
        ],
      },
    ],
    [
      onAddCue,
      onStageSettings,
      onCueList,
      onFlowLibrary,
      onPhotoParse,
      onSaveSpot,
      onAddText,
      onStageShape,
      onSetPiece,
      onAudioImport,
      onAiSuggest,
      onRosterImport,
      onMemberList,
      onMemberAdd,
      onShareLinks,
      onViewerList,
      onVideoExport,
      onHelp,
    ]
  )
}
