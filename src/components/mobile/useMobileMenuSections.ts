import { useMemo } from 'react'
import { useMobileShellBridgeStore } from '../../store/useMobileShellBridgeStore'
import type { MobileMenuIconId } from './MobileMenuIcons'

export type MobileMenuItem = {
  id: string
  label: string
  icon: MobileMenuIconId
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
        title: 'Stage',
        items: [
          { id: 'cue', label: 'キュー設定', icon: 'cue', action: onAddCue },
          { id: 'stage', label: '舞台設定', icon: 'stage', action: onStageSettings },
          { id: 'list', label: 'キュー一覧', icon: 'list', action: onCueList },
          { id: 'library', label: 'ライブラリ', icon: 'library', action: onFlowLibrary },
          { id: 'image', label: '画像キュー', icon: 'image', action: onPhotoParse },
          { id: 'save', label: '雛形保存', icon: 'save', action: onSaveSpot },
          { id: 'text', label: 'テキスト', icon: 'text', action: onAddText },
          { id: 'shape', label: '舞台変形', icon: 'shape', action: onStageShape },
          { id: 'prop', label: '大道具', icon: 'prop', action: onSetPiece },
        ],
      },
      {
        title: 'More',
        items: [
          { id: 'audio', label: '音源追加', icon: 'audio', action: onAudioImport },
          { id: 'ai', label: 'AI提案', icon: 'ai', action: onAiSuggest },
          { id: 'roster', label: '名簿取込', icon: 'roster', action: onRosterImport },
          { id: 'member', label: 'メンバー', icon: 'member', action: onMemberList },
          { id: 'add', label: 'メンバー追加', icon: 'add', action: onMemberAdd },
          { id: 'share', label: '閲覧共有', icon: 'share', action: onShareLinks },
          { id: 'export', label: 'エクスポート', icon: 'export', action: onViewerList },
          { id: 'video', label: '動画書出', icon: 'video', action: onVideoExport },
          { id: 'help', label: 'ヘルプ', icon: 'help', action: onHelp },
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
