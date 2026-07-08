type Props = {
  texts: string[];
  variant: "portrait" | "landscape";
};

/** 生徒閲覧: 舞台テキストをステージ外の専用帯に表示（内容が無いときは非表示） */
export function ChoreoViewerStageMemo({ texts, variant }: Props) {
  if (texts.length === 0) return null;

  return (
    <aside
      className={[
        "choreo-viewer-stage-memo",
        variant === "landscape"
          ? "choreo-viewer-stage-memo--landscape"
          : "choreo-viewer-stage-memo--portrait",
      ].join(" ")}
      aria-label="舞台メモ"
    >
      <div className="choreo-viewer-stage-memo__scroll">
        {texts.map((text) => (
          <p key={text} className="choreo-viewer-stage-memo__line">
            {text}
          </p>
        ))}
      </div>
    </aside>
  );
}
