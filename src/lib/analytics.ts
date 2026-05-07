// 簡易的な分析トラッキング（本番環境ではGoogle Analytics等に置き換え）
export const analytics = {
  track: (eventName: string, properties?: Record<string, any>) => {
    if (import.meta.env.DEV) {
      console.log('Analytics:', eventName, properties);
      return;
    }
    
    // 本番環境での実装
    // gtag('event', eventName, properties);
  },

  identify: (userId: string) => {
    if (import.meta.env.DEV) {
      console.log('Analytics Identify:', userId);
      return;
    }
    
    // 本番環境での実装
    // gtag('config', 'GA_MEASUREMENT_ID', { user_id: userId });
  },

  page: (pageName: string) => {
    if (import.meta.env.DEV) {
      console.log('Analytics Page:', pageName);
      return;
    }
    
    // 本番環境での実装
    // gtag('config', 'GA_MEASUREMENT_ID', { page_path: pageName });
  },
};

// イベント名の定数
export const ANALYTICS_EVENTS = {
  PROJECT_CREATED: 'project_created',
  PROJECT_SAVED: 'project_saved',
  PROJECT_SHARED: 'project_shared',
  FORMATION_CREATED: 'formation_created',
  DANCER_ADDED: 'dancer_added',
  PRESET_APPLIED: 'preset_applied',
  EXPORT_PDF: 'export_pdf',
  EXPORT_PNG: 'export_png',
  EXPORT_VIDEO: 'export_video',
  USER_SIGNUP: 'user_signup',
  USER_LOGIN: 'user_login',
} as const;
