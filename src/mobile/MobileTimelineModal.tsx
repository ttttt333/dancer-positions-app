import { TimelinePanel } from "../components/TimelinePanel";

export function MobileTimelineModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 200
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "60%",
          background: "#020617",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 10,
          overflow: "auto"
        }}
      >
        <TimelinePanel />
      </div>
    </div>
  );
}
