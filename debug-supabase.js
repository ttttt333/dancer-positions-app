import { createClient } from '@supabase/supabase-js'

// .env.localから環境変数を読み込み
const supabaseUrl = 'https://iiziplsgfoijvnrsehms.supabase.co'
const supabaseAnonKey = 'ここに正しいキーを貼り付け'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSupabaseConnection() {
  console.log('=== Supabase接続テスト ===')
  console.log('URL:', supabaseUrl)
  console.log('KEY:', supabaseAnonKey.substring(0, 20) + '...')
  
  try {
    const { data, error } = await supabase
      .from("choreocore_projects")
      .select("*")
    
    console.log("data:", data)
    console.log("error:", error)
    
    if (error) {
      console.error('❌ Supabaseエラー:', error)
    } else if (data) {
      console.log('✅ データ取得成功:', data.length, '件')
      data.forEach((project, index) => {
        console.log(`プロジェクト${index + 1}:`, project.name, '(ID:', project.id, ')')
      })
    } else {
      console.log('⚠️ データはありません')
    }
  } catch (err) {
    console.error('❌ 予期せぬエラー:', err)
  }
}

testSupabaseConnection()
