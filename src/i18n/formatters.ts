import type { AppLocale } from "./types";

/**
 * 数値を各国のロケールに合わせてフォーマット
 */
export const formatNumber = (num: number, locale: AppLocale): string => {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * パーセンテージをフォーマット（例: 75.5%）
 */
export const formatPercentage = (num: number, locale: AppLocale): string => {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(num / 100);
};

/**
 * BPM（Beats Per Minute）をフォーマット
 */
export const formatBPM = (bpm: number, locale: AppLocale): string => {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(bpm);
};

/**
 * 時間をフォーマット（例: 02:30）
 */
export const formatDuration = (seconds: number, locale: AppLocale): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  // ロケールに合わせて時間フォーマットを調整
  if (locale === 'ja' || locale === 'ko' || locale === 'zh') {
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  // 英語・欧州言語では小数点表記
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * 日付を各国のロケールに合わせてフォーマット
 */
export const formatDate = (date: Date, locale: AppLocale): string => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

/**
 * 日時を各国のロケールに合わせてフォーマット
 */
export const formatDateTime = (date: Date, locale: AppLocale): string => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/**
 * 相対時間をフォーマット（例: "2分前"）
 */
export const formatRelativeTime = (date: Date, locale: AppLocale): string => {
  const rtf = new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
  });
  
  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  
  if (diffSeconds < 60) {
    return rtf.format(diffSeconds, 'second');
  } else if (diffSeconds < 3600) {
    return rtf.format(Math.floor(diffSeconds / 60), 'minute');
  } else if (diffSeconds < 86400) {
    return rtf.format(Math.floor(diffSeconds / 3600), 'hour');
  } else {
    return rtf.format(Math.floor(diffSeconds / 86400), 'day');
  }
};

/**
 * メートル単位をフォーマット（例: "1.5m"）
 */
export const formatMeters = (meters: number, locale: AppLocale): string => {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(meters);
};

/**
 * フィート単位をフォーマット（例: "4.9ft"）
 */
export const formatFeet = (feet: number, locale: AppLocale): string => {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(feet);
};
