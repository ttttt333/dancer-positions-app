import { createClient } from '@supabase/supabase-js';

// Supabaseクライアントの初期化
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://iiziplsgfoijvnrsehms.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpemlwbHNnZm9panZucnNlaG1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTcxNzIsImV4cCI6MjA5MzA5MzE3Mn0.kdJFWV8hJgqfYkYVCctTJoQiwPxH1LwyoG85OjM-bh';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 認証関連のヘルパー関数
export const auth = {
  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// データベース操作のヘルパー関数
export const db = {
  // プロジェクト関連
  projects: {
    create: async (projectData: any) => {
      const { data, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single();
      return { data, error };
    },

    get: async (projectId: string) => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      return { data, error };
    },

    update: async (projectId: string, updates: any) => {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();
      return { data, error };
    },

    delete: async (projectId: string) => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
      return { error };
    },

    list: async (userId: string) => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      return { data, error };
    },
  },

  // 共有トークン関連
  shareTokens: {
    create: async (tokenData: any) => {
      const { data, error } = await supabase
        .from('share_tokens')
        .insert(tokenData)
        .select()
        .single();
      return { data, error };
    },

    get: async (token: string) => {
      const { data, error } = await supabase
        .from('share_tokens')
        .select('*')
        .eq('token', token)
        .single();
      return { data, error };
    },
  },
};
