import { useI18n } from "../i18n/I18nContext";
import { useViewerChromeStore } from "../store/viewerChromeStore";

type DockButtonProps = {
  active: boolean;
  label: string;
  title: string;
  onClick: () => void;
};

function DockButton({ active, label, title, onClick }: DockButtonProps) {
  return (
    <button
      type="button"
      className={[
        "choreo-viewer-chrome-dock__btn",
        active ? "choreo-viewer-chrome-dock__btn--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={active}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/** 共有閲覧: 波形・操作・キュー・詳細を個別に畳むドック（舞台は常に表示） */
export function ChoreoViewerChromeDock() {
  const { t } = useI18n();
  const waveVisible = useViewerChromeStore((s) => s.waveVisible);
  const controlsVisible = useViewerChromeStore((s) => s.controlsVisible);
  const cuePagerVisible = useViewerChromeStore((s) => s.cuePagerVisible);
  const detailsVisible = useViewerChromeStore((s) => s.detailsVisible);
  const toggleWave = useViewerChromeStore((s) => s.toggleWave);
  const toggleControls = useViewerChromeStore((s) => s.toggleControls);
  const toggleCuePager = useViewerChromeStore((s) => s.toggleCuePager);
  const toggleDetails = useViewerChromeStore((s) => s.toggleDetails);
  const enterStageOnly = useViewerChromeStore((s) => s.enterStageOnly);

  return (
    <nav
      className="choreo-viewer-chrome-dock"
      aria-label={t("editor.layout.viewerChromeDockAria")}
    >
      <DockButton
        active={waveVisible}
        label={t("editor.layout.viewerChromeWaveShort")}
        title={t("editor.layout.viewerChromeWaveToggle")}
        onClick={toggleWave}
      />
      <DockButton
        active={controlsVisible}
        label={t("editor.layout.viewerChromeControlsShort")}
        title={t("editor.layout.viewerChromeControlsToggle")}
        onClick={toggleControls}
      />
      <DockButton
        active={cuePagerVisible}
        label={t("editor.layout.viewerChromeCueShort")}
        title={t("editor.layout.viewerChromeCueToggle")}
        onClick={toggleCuePager}
      />
      <DockButton
        active={detailsVisible}
        label={t("editor.layout.viewerChromeDetailsShort")}
        title={t("editor.layout.viewerChromeDetailsToggle")}
        onClick={toggleDetails}
      />
      <button
        type="button"
        className="choreo-viewer-chrome-dock__btn choreo-viewer-chrome-dock__btn--stage"
        title={t("editor.layout.viewerChromeCollapse")}
        aria-label={t("editor.layout.viewerChromeCollapse")}
        onClick={enterStageOnly}
      >
        {t("editor.layout.viewerChromeStageShort")}
      </button>
    </nav>
  );
}
