import React from 'react';
import { useI18n } from '../i18n';

interface TProps {
  key: string;
  params?: Record<string, string | number>;
  fallback?: string;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  children?: React.ReactNode;
}

/**
 * 翻訳用のTコンポーネント
 * 
 * @example
 * <T key="dashboard.heroTitle" />
 * <T key="common.loading" />
 * <T key="editor.save" params={{ count: 5 }} />
 */
export const T: React.FC<TProps> = ({ 
  key, 
  params, 
  fallback, 
  className, 
  as: Component = 'span', 
  children 
}) => {
  const { t } = useI18n();
  
  const text = t(key, params) || fallback || key;
  
  return React.createElement(
    Component, 
    { className, title: text },
    children || text
  );
};

export default T;
