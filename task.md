# Mobile UI Implementation

## Architecture
- mobileStackEditor = true when viewport < breakpoint (editorViewportKey[0]==="1")
- Currently: DesktopEditor handles mobile via mobileStackEditor flag — messy, cramped
- Plan: When mobileStackEditor===true, render NEW <MobileEditorShell> instead of current layout
- MobileEditorShell owns: header, stage, waveform, playbar, bottomtab, menu-sheet, cue-list

## Files to create
1. src/components/mobile/MobileEditorShell.tsx  ← main container
2. src/components/mobile/MobileBottomTabBar.tsx  ← 4-tab bar
3. src/components/mobile/MobileToolSheet.tsx     ← bottom-sheet menu
4. src/components/mobile/MobileCueList.tsx       ← cues tab panel
5. src/components/mobile/MobilePlaybar.tsx       ← waveform+playback strip

## Files to modify
- src/pages/DesktopEditor.tsx: add early-return when mobileStackEditor===true

## Key props to pass in (from DesktopEditor)
- project, setProjectSafe
- stageWorkbenchProps (all the callbacks)
- isPlaying, togglePlay, stopPlayback, seekForward5Sec, seekBackward5Sec
- duration, currentTime
- selectedCueId
- editorMobileLandscape
- All dialog open handlers (setAiSuggestOpen, setAddCueDialogOpen, etc.)

## Design decisions
- Portrait: stage 65% | waveform 52px | playbar 60px | bottomtab 56px+safe
- Landscape: stage 60% left | right panel 40% (members+tools)
- Bottom sheet: 3-col grid, section-labeled, same icon language as desktop
- Cue list tab: filmstrip + list cards
- Swipe stage = previous/next cue
- Haptics on cue change
- No text labels on icons except AI提案

## Status
- [ ] MobilePlaybar
- [ ] MobileBottomTabBar  
- [ ] MobileToolSheet
- [ ] MobileCueList
- [ ] MobileEditorShell
- [ ] DesktopEditor wiring
