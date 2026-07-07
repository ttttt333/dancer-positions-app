/**
 * 横画面で波形をたたんだあと、画面下端に常時出す「波形を表示」タブ
 */

import React from "react";
import styles from "./LandscapeWaveExpandTab.module.css";
import { abortTimelineWavePointerGestures } from "../../lib/abortTimelineWavePointerGestures";

type Props = {
  onExpand: () => void;
};

export const LandscapeWaveExpandTab: React.FC<Props> = ({ onExpand }) => {
  return (
    <button
      type="button"
      className={styles.tab}
      onClick={() => {
        abortTimelineWavePointerGestures();
        onExpand();
      }}
      aria-label="波形を表示"
      title="波形を表示"
    >
      <span className={styles.chevron} aria-hidden>
        ▲
      </span>
      <span className={styles.label}>波形を表示</span>
    </button>
  );
};
