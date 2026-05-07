import { createClient } from '@supabase/supabase-js'

// 環境変数を設定
const supabaseUrl = 'https://iiziplsgfoijvnrsehms.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpemlwbHNnZm9panZucnNlaG1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTcxNzIsImV4cCI6MjA5MzA5MzE3Mn0.kdJFWV8hJgqfYkYVCctTJoQiwPxH1LwyoG85OjM-bhg'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugLibraryData() {
  console.log('=== ライブラリデータデバッグ ===')
  
  try {
    // 1. 認証状態を確認
    const { data: authData, error: authError } = await supabase.auth.getUser()
    console.log('認証状態:', authData)
    if (authError) console.log('認証エラー:', authError)
    
    // 2. choreocore_projectsテーブルから全データを取得
    const { data: projects, error: projectsError } = await supabase
      .from('choreocore_projects')
      .select('*')
    
    console.log('プロジェクトデータ:', projects)
    if (projectsError) console.log('プロジェクト取得エラー:', projectsError)
    
    // 3. jsonカラムの構造を確認
    if (projects && projects.length > 0) {
      console.log('=== jsonカラムの構造 ===')
      projects.forEach((project, index) => {
        console.log(`プロジェクト${index + 1}:`)
        console.log('- id:', project.id)
        console.log('- name:', project.name)
        console.log('- json type:', typeof project.json)
        console.log('- json keys:', project.json ? Object.keys(project.json) : 'null')
        
        if (project.json) {
          console.log('- formations:', project.json.formations ? `${project.json.formations.length}件` : 'なし')
          console.log('- cues:', project.json.cues ? `${project.json.cues.length}件` : 'なし')
          console.log('- stageSettings:', project.json.stageSettings ? 'あり' : 'なし')
        }
        console.log('---')
      })
    }
    
    // 4. user_idフィルターで確認
    if (authData.user) {
      const { data: userProjects, error: userProjectsError } = await supabase
        .from('choreocore_projects')
        .select('*')
        .eq('user_id', authData.user.id)
      
      console.log('ユーザープロジェクト:', userProjects)
      if (userProjectsError) console.log('ユーザープロジェクト取得エラー:', userProjectsError)
    }
    
  } catch (err) {
    console.error('予期せぬエラー:', err)
  }
}

debugLibraryData()
