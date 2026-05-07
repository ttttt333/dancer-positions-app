import { createClient } from "@supabase/supabase-js";
import type { AudioAsset, AudioAssetUpload, AudioAssetResponse } from "../types/audioAssets";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

/**
 * 音源ファイルをSupabase Storageにアップロードし、audio_assetsテーブルに登録
 */
export async function uploadAudioAsset(
  uploadData: AudioAssetUpload
): Promise<AudioAssetResponse> {
  try {
    // 1. Supabase Storageにファイルアップロード
    const fileName = `${Date.now()}_${uploadData.filename}`;
    const { data: uploadResult, error: uploadError } = await supabase.storage
      .from("choreocore-audio")
      .upload(fileName, uploadData.file, {
        contentType: uploadData.mime_type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // 2. audio_assetsテーブルにレコード作成
    const wavePeaksJson = uploadData.wave_peaks 
      ? JSON.stringify(uploadData.wave_peaks) 
      : null;

    const { data: assetData, error: insertError } = await supabase
      .from("audio_assets")
      .insert({
        filename: uploadData.filename,
        mime_type: uploadData.mime_type,
        file_size: uploadData.file_size,
        duration_sec: uploadData.duration_sec,
        storage_path: uploadResult.path,
        wave_peaks: wavePeaksJson,
      })
      .select()
      .single();

    if (insertError) {
      // レコード作成失敗時、アップロードしたファイルを削除
      await supabase.storage.from("choreocore-audio").remove([uploadResult.path]);
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    // 3. レスポンス形式に変換
    return {
      ...assetData,
      wave_peaks: assetData.wave_peaks ? JSON.parse(assetData.wave_peaks) : null,
    };
  } catch (error) {
    console.error("Audio asset upload failed:", error);
    throw error;
  }
}

/**
 * 音源ファイルをダウンロード
 */
export async function downloadAudioAsset(
  storagePath: string
): Promise<Blob> {
  try {
    const { data, error } = await supabase.storage
      .from("choreocore-audio")
      .download(storagePath);

    if (error) {
      throw new Error(`Download failed: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Audio asset download failed:", error);
    throw error;
  }
}

/**
 * 音源リストを取得
 */
export async function listAudioAssets(): Promise<AudioAssetResponse[]> {
  try {
    const { data, error } = await supabase
      .from("audio_assets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`List failed: ${error.message}`);
    }

    return data.map(asset => ({
      ...asset,
      wave_peaks: asset.wave_peaks ? JSON.parse(asset.wave_peaks) : null,
    }));
  } catch (error) {
    console.error("Audio assets list failed:", error);
    throw error;
  }
}

/**
 * 音源情報を取得
 */
export async function getAudioAsset(id: number): Promise<AudioAssetResponse | null> {
  try {
    const { data, error } = await supabase
      .from("audio_assets")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // レコードが存在しない
      }
      throw new Error(`Get failed: ${error.message}`);
    }

    return {
      ...data,
      wave_peaks: data.wave_peaks ? JSON.parse(data.wave_peaks) : null,
    };
  } catch (error) {
    console.error("Audio asset get failed:", error);
    throw error;
  }
}

/**
 * 音源を削除
 */
export async function deleteAudioAsset(id: number): Promise<void> {
  try {
    // 1. 音源情報を取得
    const asset = await getAudioAsset(id);
    if (!asset) {
      throw new Error("Audio asset not found");
    }

    // 2. データベースからレコード削除
    const { error: deleteError } = await supabase
      .from("audio_assets")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw new Error(`Database delete failed: ${deleteError.message}`);
    }

    // 3. Storageからファイル削除
    const { error: storageError } = await supabase.storage
      .from("choreocore-audio")
      .remove([asset.storage_path]);

    if (storageError) {
      console.warn("Storage delete failed:", storageError.message);
      // データベース削除は成功しているので、警告のみ表示
    }
  } catch (error) {
    console.error("Audio asset delete failed:", error);
    throw error;
  }
}

/**
 * 音源の署名付きURLを取得（直接再生用）
 */
export async function getAudioAssetSignedUrl(
  storagePath: string,
  expiresIn: number = 3600 // 1時間
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from("choreocore-audio")
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      throw new Error(`Signed URL creation failed: ${error.message}`);
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Signed URL creation failed:", error);
    throw error;
  }
}

/**
 * 音源の公開URLを取得
 */
export function getAudioAssetPublicUrl(storagePath: string): string {
  try {
    const { data } = supabase.storage
      .from("choreocore-audio")
      .getPublicUrl(storagePath);

    return data.publicUrl;
  } catch (error) {
    console.error("Public URL creation failed:", error);
    throw error;
  }
}
