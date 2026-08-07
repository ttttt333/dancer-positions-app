/**
 * 実演会照明プラン蓄積データ（自動生成）
 * 生成: scripts ingest from Downloads CSVs
 * 元CSV: data/lighting-plans/
 */

import type { LightingPlanShow } from "./types";

export const LIGHTING_PLAN_SHOWS: LightingPlanShow[] = [
  {
    "id": "2025_19th_finale",
    "title": "FINALE",
    "event": "第19回 S.O.P発表会",
    "className": "FINALE",
    "trackTitle": "WE ARE S.O.P",
    "durationSec": 784,
    "dancerCount": 47,
    "atmosphere": "歓喜 楽しみ 明るく",
    "points": "メンバー紹介 ピンスポ 講師紹介へのピンスポ 音響 ボリューム調整",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-FINALE.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 48,
        "progressStart": 0,
        "progressEnd": 0.0612,
        "note": "明るく おまかせ",
        "inferredSection": "intro",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "free",
          "bright",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 48,
        "endSec": 96,
        "progressStart": 0.0612,
        "progressEnd": 0.1224,
        "note": "サビ 明るくおまかせ",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "neutral",
        "tags": [
          "free",
          "bright",
          "chorus"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 96,
        "endSec": 128,
        "progressStart": 0.1224,
        "progressEnd": 0.1633,
        "note": "2番 明るく おまかせ",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "free",
          "bright"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 128,
        "endSec": 160,
        "progressStart": 0.1633,
        "progressEnd": 0.2041,
        "note": "サビ 明るくおまかせ",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "neutral",
        "tags": [
          "free",
          "bright",
          "chorus"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 160,
        "endSec": 334,
        "progressStart": 0.2041,
        "progressEnd": 0.426,
        "note": "メンバー紹介 映像のため暗くする 後半 講師紹介で明るくしてピンスポで追う",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "dim",
        "tags": [
          "pin_spot",
          "dim",
          "bright",
          "feature"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 334,
        "endSec": 346,
        "progressStart": 0.426,
        "progressEnd": 0.4413,
        "note": "フィナーレ後半合わせ スタート フェードイン",
        "inferredSection": "intro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "dim",
          "intro"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 346,
        "endSec": 410,
        "progressStart": 0.4413,
        "progressEnd": 0.523,
        "note": "サビ 明るく",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "neutral",
        "tags": [
          "bright",
          "chorus"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 410,
        "endSec": 425,
        "progressStart": 0.523,
        "progressEnd": 0.5421,
        "note": "キャノン砲",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "outro"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 425,
        "endSec": 784,
        "progressStart": 0.5421,
        "progressEnd": 1,
        "note": "S.O.Pジャンプ みんなで踊る お辞儀 緞帳を下ろす",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "dim",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_オープニング",
    "title": "オープニング",
    "event": "第19回 S.O.P発表会",
    "className": "オープニング",
    "trackTitle": "BLOOM",
    "durationSec": 185,
    "dancerCount": 47,
    "atmosphere": "かっこよくサビは明るく賑やかに",
    "points": "初めのSS、サス、ピンスポ",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-オープニング.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 9,
        "progressStart": 0,
        "progressEnd": 0.0486,
        "note": "音の始まりと同時にssで雰囲気を出す センターへそにサスとピンスポからスタート 赤系",
        "inferredSection": "intro",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "red",
        "tags": [
          "pin_spot",
          "sus",
          "ss",
          "center",
          "red",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 9,
        "endSec": 31,
        "progressStart": 0.0486,
        "progressEnd": 0.1676,
        "note": "赤系で雰囲気を出してください",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 31,
        "endSec": 43,
        "progressStart": 0.1676,
        "progressEnd": 0.2324,
        "note": "サビ 黄色など色を増やして少し明るめに動きを出してください",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "yellow",
        "tags": [
          "bright",
          "yellow",
          "chorus"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 43,
        "endSec": 55,
        "progressStart": 0.2324,
        "progressEnd": 0.2973,
        "note": "間奏 青系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "interlude",
          "blue"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 55,
        "endSec": 80,
        "progressStart": 0.2973,
        "progressEnd": 0.4324,
        "note": "2番 赤系で雰囲気をお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 80,
        "endSec": 93,
        "progressStart": 0.4324,
        "progressEnd": 0.5027,
        "note": "サビ 黄色など色を増やして少し明るめに動きを出してください",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "yellow",
        "tags": [
          "bright",
          "yellow",
          "chorus"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 93,
        "endSec": 105,
        "progressStart": 0.5027,
        "progressEnd": 0.5676,
        "note": "選抜パート 色と雰囲気を変えて 黄色系に",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "yellow",
        "tags": [
          "feature",
          "yellow"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 105,
        "endSec": 130,
        "progressStart": 0.5676,
        "progressEnd": 0.7027,
        "note": "明るくおまかせです",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "free",
          "bright"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 130,
        "endSec": 142,
        "progressStart": 0.7027,
        "progressEnd": 0.7676,
        "note": "雰囲気変化 紫系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "purple",
        "tags": [
          "purple"
        ]
      },
      {
        "cueNo": 10,
        "startSec": 142,
        "endSec": 155,
        "progressStart": 0.7676,
        "progressEnd": 0.8378,
        "note": "雰囲気変化だんだん盛り上がってくる",
        "inferredSection": "drop",
        "lightingPreset": "strobe_flash",
        "colorMood": "neutral",
        "tags": [
          "bright",
          "buildup"
        ]
      },
      {
        "cueNo": 11,
        "startSec": 155,
        "endSec": 167,
        "progressStart": 0.8378,
        "progressEnd": 0.9027,
        "note": "明るくおまかせです",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "free",
          "bright"
        ]
      },
      {
        "cueNo": 12,
        "startSec": 167,
        "endSec": 185,
        "progressStart": 0.9027,
        "progressEnd": 1,
        "note": "SS強めでおまかせです",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "ss",
          "free"
        ]
      },
      {
        "cueNo": 13,
        "startSec": 185,
        "endSec": 185,
        "progressStart": 1,
        "progressEnd": 1,
        "note": "最後に花が咲いていくイメージでカウント1で余韻を残して終わります",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "dim",
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_土曜10時超入門クラス",
    "title": "土曜10時超入門クラス",
    "event": "第19回 S.O.P発表会",
    "className": "土曜10時超入門クラス",
    "trackTitle": "BLOOM imazu ayumu TWS",
    "durationSec": 186,
    "dancerCount": 31,
    "atmosphere": "楽しい 明るい 元気",
    "points": "グループダンスでサスを使います",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-土曜10時超入門クラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 9,
        "progressStart": 0,
        "progressEnd": 0.0484,
        "note": "真ん中で集まってスタート ビートに合わせて上手く照明をつけてください",
        "inferredSection": "intro",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "center",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 9,
        "endSec": 42,
        "progressStart": 0.0484,
        "progressEnd": 0.2258,
        "note": "黄色でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "yellow"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 42,
        "endSec": 59,
        "progressStart": 0.2258,
        "progressEnd": 0.3172,
        "note": "曲調変化 青系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 59,
        "endSec": 75,
        "progressStart": 0.3172,
        "progressEnd": 0.4032,
        "note": "サビ カラフルでおまかせです",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "free",
          "bright",
          "colorful",
          "chorus"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 75,
        "endSec": 92,
        "progressStart": 0.4032,
        "progressEnd": 0.4946,
        "note": "ペア 赤系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 92,
        "endSec": 100,
        "progressStart": 0.4946,
        "progressEnd": 0.5376,
        "note": "黄色系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "yellow"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 100,
        "endSec": 117,
        "progressStart": 0.5376,
        "progressEnd": 0.629,
        "note": "曲調変化 青系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 117,
        "endSec": 150,
        "progressStart": 0.629,
        "progressEnd": 0.8065,
        "note": "グループダンス サス2エイト センター 上手 センター 下手",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "neutral",
        "tags": [
          "sus",
          "center",
          "group"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 150,
        "endSec": 154,
        "progressStart": 0.8065,
        "progressEnd": 0.828,
        "note": "全体を一度明るく",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "bright"
        ]
      },
      {
        "cueNo": 10,
        "startSec": 154,
        "endSec": 162,
        "progressStart": 0.828,
        "progressEnd": 0.871,
        "note": "グループダンス サス2エイト センター",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "neutral",
        "tags": [
          "sus",
          "center",
          "group"
        ]
      },
      {
        "cueNo": 11,
        "startSec": 162,
        "endSec": 183,
        "progressStart": 0.871,
        "progressEnd": 0.9839,
        "note": "カラフルで明るめでお願いします",
        "inferredSection": "outro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "colorful",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_土曜ちびちびクラス",
    "title": "土曜ちびちびクラス",
    "event": "第19回 S.O.P発表会",
    "className": "土曜ちびちびクラス",
    "trackTitle": "カウントダウン/ KAWAII",
    "durationSec": 186,
    "dancerCount": 23,
    "atmosphere": "1曲目かっこいい 明るい 2曲目 明るく 元気 可愛い",
    "points": "2曲使い",
    "pinSpot": false,
    "sourceFile": "data/lighting-plans/2025-19th-土曜ちびちびクラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 20,
        "progressStart": 0,
        "progressEnd": 0.1075,
        "note": "SSも使って青系でおまかせです",
        "inferredSection": "intro",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "blue",
        "tags": [
          "ss",
          "free",
          "blue",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 20,
        "endSec": 28,
        "progressStart": 0.1075,
        "progressEnd": 0.1505,
        "note": "明るく黄色系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "bright",
          "yellow"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 28,
        "endSec": 44,
        "progressStart": 0.1505,
        "progressEnd": 0.2366,
        "note": "曲調変化 緑系でおまかせです",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "green",
        "tags": [
          "free",
          "green"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 44,
        "endSec": 61,
        "progressStart": 0.2366,
        "progressEnd": 0.328,
        "note": "曲調変化 青系でおまかせえです",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "free",
          "blue"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 61,
        "endSec": 77,
        "progressStart": 0.328,
        "progressEnd": 0.414,
        "note": "サビ 紫系でおまかせです",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "purple",
        "tags": [
          "free",
          "purple",
          "chorus"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 77,
        "endSec": 96,
        "progressStart": 0.414,
        "progressEnd": 0.5161,
        "note": "曲調変化 ラララ 黄色系でおまかせです",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "free",
          "yellow"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 96,
        "endSec": 105,
        "progressStart": 0.5161,
        "progressEnd": 0.5645,
        "note": "2曲目 イントロ SSを目立たせて少し暗め紫系でおまかせです",
        "inferredSection": "intro",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "purple",
        "tags": [
          "ss",
          "free",
          "dim",
          "purple",
          "intro"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 105,
        "endSec": 135,
        "progressStart": 0.5645,
        "progressEnd": 0.7258,
        "note": "明るく 紫とムービングをお願いします",
        "inferredSection": "verse",
        "lightingPreset": "strobe_flash",
        "colorMood": "purple",
        "tags": [
          "motion",
          "bright",
          "purple"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 135,
        "endSec": 150,
        "progressStart": 0.7258,
        "progressEnd": 0.8065,
        "note": "曲調変化 赤系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 10,
        "startSec": 150,
        "endSec": 165,
        "progressStart": 0.8065,
        "progressEnd": 0.8871,
        "note": "サビ カラフルでおまかせです",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "free",
          "bright",
          "colorful",
          "chorus"
        ]
      },
      {
        "cueNo": 11,
        "startSec": 165,
        "endSec": 180,
        "progressStart": 0.8871,
        "progressEnd": 0.9677,
        "note": "カラフルでおまかせです",
        "inferredSection": "outro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "free",
          "bright",
          "colorful"
        ]
      },
      {
        "cueNo": 12,
        "startSec": 180,
        "endSec": 186,
        "progressStart": 0.9677,
        "progressEnd": 1,
        "note": "最後はカウント1で余韻があって終わります",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "dim",
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_月4ちびちび",
    "title": "月4ちびちび",
    "event": "第19回 S.O.P発表会",
    "className": "月4ちびちび",
    "trackTitle": "ポケモンONE ONLY STORY アイドルプリキュア",
    "durationSec": 208,
    "dancerCount": 12,
    "atmosphere": "かっこいい 楽しい 可愛い",
    "points": "1曲目 かっこいい 2曲目 楽しい 可愛い",
    "pinSpot": false,
    "sourceFile": "data/lighting-plans/2025-19th-月4ちびちび.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 29,
        "progressStart": 0,
        "progressEnd": 0.1394,
        "note": "青系でスタート 明るめ",
        "inferredSection": "intro",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "bright",
          "blue",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 29,
        "endSec": 42,
        "progressStart": 0.1394,
        "progressEnd": 0.2019,
        "note": "Aメロ おまかせです",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "free"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 42,
        "endSec": 57,
        "progressStart": 0.2019,
        "progressEnd": 0.274,
        "note": "Bメロ 少し雰囲気を変えてください",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": []
      },
      {
        "cueNo": 4,
        "startSec": 57,
        "endSec": 72,
        "progressStart": 0.274,
        "progressEnd": 0.3462,
        "note": "サビ 明るく",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "neutral",
        "tags": [
          "bright",
          "chorus"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 75,
        "endSec": 114,
        "progressStart": 0.3606,
        "progressEnd": 0.5481,
        "note": "2曲目 プリキュア カラフルにお願いします",
        "inferredSection": "verse",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "colorful"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 114,
        "endSec": 126,
        "progressStart": 0.5481,
        "progressEnd": 0.6058,
        "note": "曲変化 雰囲気を変えてください ピンク系",
        "inferredSection": "verse",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "purple",
        "tags": [
          "pin_spot",
          "purple"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 126,
        "endSec": 150,
        "progressStart": 0.6058,
        "progressEnd": 0.7212,
        "note": "サビ カラフル明るくムービングで動きを出してください",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "motion",
          "bright",
          "colorful",
          "chorus"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 150,
        "endSec": 163,
        "progressStart": 0.7212,
        "progressEnd": 0.7837,
        "note": "曲変化 雰囲気を変えてください 青系",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 163,
        "endSec": 176,
        "progressStart": 0.7837,
        "progressEnd": 0.8462,
        "note": "ラスト カラフルで明るく",
        "inferredSection": "outro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "ending",
          "colorful",
          "outro"
        ]
      },
      {
        "cueNo": 10,
        "startSec": 176,
        "endSec": 191,
        "progressStart": 0.8462,
        "progressEnd": 0.9183,
        "note": "カウント2でポーズです",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_月曜5時キッズスタートクラス",
    "title": "月曜5時キッズスタートクラス",
    "event": "第19回 S.O.P発表会",
    "className": "月曜5時キッズスタートクラス",
    "trackTitle": "dancing with my finger /dreamin' on",
    "durationSec": 189,
    "dancerCount": 29,
    "atmosphere": "かっこいい 元気",
    "points": "スタートの4カウントピンスポ 1曲目後半のサスをつけるところ 2曲使い",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-月曜5時キッズスタートクラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 11,
        "progressStart": 0,
        "progressEnd": 0.0582,
        "note": "ギターの音でスタート SSプラス黄色系でお願いします",
        "inferredSection": "intro",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "yellow",
        "tags": [
          "ss",
          "yellow",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 9,
        "endSec": 11,
        "progressStart": 0.0476,
        "progressEnd": 0.0582,
        "note": "センター 一平くん 4カウントのみピンスポ",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "center"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 11,
        "endSec": 72,
        "progressStart": 0.0582,
        "progressEnd": 0.381,
        "note": "青系でおまかせです",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "free",
          "blue"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 72,
        "endSec": 79,
        "progressStart": 0.381,
        "progressEnd": 0.418,
        "note": "雰囲気変化 サスを3つとも2エイトつけます 黄色系で",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "yellow",
        "tags": [
          "sus",
          "yellow"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 89,
        "endSec": 114,
        "progressStart": 0.4709,
        "progressEnd": 0.6032,
        "note": "2曲目イントロ オレンジ系でお願いします",
        "inferredSection": "intro",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "yellow",
          "intro"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 114,
        "endSec": 149,
        "progressStart": 0.6032,
        "progressEnd": 0.7884,
        "note": "Aメロ 色変化 緑系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "green",
        "tags": [
          "green"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 149,
        "endSec": 175,
        "progressStart": 0.7884,
        "progressEnd": 0.9259,
        "note": "サビ オレンジ系でお願いします",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "yellow",
        "tags": [
          "yellow",
          "chorus"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 175,
        "endSec": 187,
        "progressStart": 0.9259,
        "progressEnd": 0.9894,
        "note": "曲調変化 赤系でおまかせです",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "red",
        "tags": [
          "free",
          "red"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 187,
        "endSec": 189,
        "progressStart": 0.9894,
        "progressEnd": 1,
        "note": "ラストは7で長い高い声でみんな腕を掲げて終わります",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_月曜6時houseクラス",
    "title": "月曜6時HOUSEクラス",
    "event": "第19回 S.O.P発表会",
    "className": "月曜6時HOUSEクラス",
    "trackTitle": "everything",
    "durationSec": 176,
    "dancerCount": 34,
    "atmosphere": "クールな感じから盛り上がって最後はまたクールな感じに戻る",
    "points": "ソロピンスポあり センターサスあり",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-月曜6時HOUSEクラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 32,
        "progressStart": 0,
        "progressEnd": 0.1818,
        "note": "だんだんBEATとともに踊る人が増えていく SSと素明かり",
        "inferredSection": "intro",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "white",
        "tags": [
          "ss",
          "white",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 32,
        "endSec": 63,
        "progressStart": 0.1818,
        "progressEnd": 0.358,
        "note": "赤を付け足してください",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 63,
        "endSec": 78,
        "progressStart": 0.358,
        "progressEnd": 0.4432,
        "note": "ソロ4エイト ピンスポ 全体的にはある程度明るく センター後ろから前に出てきます",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "solo",
          "center",
          "bright"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 78,
        "endSec": 93,
        "progressStart": 0.4432,
        "progressEnd": 0.5284,
        "note": "明るく賑やかにお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "bright"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 93,
        "endSec": 104,
        "progressStart": 0.5284,
        "progressEnd": 0.5909,
        "note": "センター サスを照らす 3エイト 8カウントソロ3人",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "neutral",
        "tags": [
          "sus",
          "solo",
          "center"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 104,
        "endSec": 109,
        "progressStart": 0.5909,
        "progressEnd": 0.6193,
        "note": "明るく賑やかにお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "bright"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 109,
        "endSec": 124,
        "progressStart": 0.6193,
        "progressEnd": 0.7045,
        "note": "曲調変化 紫系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "purple",
        "tags": [
          "purple"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 124,
        "endSec": 139,
        "progressStart": 0.7045,
        "progressEnd": 0.7898,
        "note": "曲調変化 赤系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 139,
        "endSec": 170,
        "progressStart": 0.7898,
        "progressEnd": 0.9659,
        "note": "曲調変化 青系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 10,
        "startSec": 170,
        "endSec": 176,
        "progressStart": 0.9659,
        "progressEnd": 1,
        "note": "ラストはカウント1でステップからのポーズ",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_月曜7時初心者クラス",
    "title": "月曜7時初心者クラス",
    "event": "第19回 S.O.P発表会",
    "className": "月曜7時初心者クラス",
    "trackTitle": "sorry -justin bieber/ LMFAO-sorry for party rockin",
    "durationSec": 195,
    "dancerCount": 32,
    "atmosphere": "1曲目明るい 楽しい 2曲目 盛り上げ 楽しい 弾ける",
    "points": "ピンスポあり &グループダンス4等分 下手前側から上手前側、下手後ろ、上手後ろ",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-月曜7時初心者クラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 10,
        "progressStart": 0,
        "progressEnd": 0.0513,
        "note": "バックライトを使って 赤系でお願いします",
        "inferredSection": "intro",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "backlight",
          "red",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 10,
        "endSec": 29,
        "progressStart": 0.0513,
        "progressEnd": 0.1487,
        "note": "赤系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 29,
        "endSec": 48,
        "progressStart": 0.1487,
        "progressEnd": 0.2462,
        "note": "雰囲気を変えて 黄色系でお願いします だんだん盛り上がる",
        "inferredSection": "drop",
        "lightingPreset": "strobe_flash",
        "colorMood": "yellow",
        "tags": [
          "bright",
          "buildup",
          "yellow"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 48,
        "endSec": 67,
        "progressStart": 0.2462,
        "progressEnd": 0.3436,
        "note": "サビ 明るく おまかせです",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "neutral",
        "tags": [
          "free",
          "bright",
          "chorus"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 67,
        "endSec": 77,
        "progressStart": 0.3436,
        "progressEnd": 0.3949,
        "note": "少し明るさを落として 青系",
        "inferredSection": "verse",
        "lightingPreset": "full_bright_warm",
        "colorMood": "blue",
        "tags": [
          "dim",
          "bright",
          "blue"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 79,
        "endSec": 96,
        "progressStart": 0.4051,
        "progressEnd": 0.4923,
        "note": "2曲目 イントロ 盛り上げ 賑やかに",
        "inferredSection": "intro",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "bright",
          "intro"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 96,
        "endSec": 119,
        "progressStart": 0.4923,
        "progressEnd": 0.6103,
        "note": "Aメロ カラフルでおまかせ",
        "inferredSection": "verse",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "free",
          "bright",
          "colorful"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 119,
        "endSec": 124,
        "progressStart": 0.6103,
        "progressEnd": 0.6359,
        "note": "雰囲気を変えます 青系",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 124,
        "endSec": 131,
        "progressStart": 0.6359,
        "progressEnd": 0.6718,
        "note": "ピンスポ 真ん中ヘソ ジョニーさん 2エイト",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "center"
        ]
      },
      {
        "cueNo": 10,
        "startSec": 136,
        "endSec": 164,
        "progressStart": 0.6974,
        "progressEnd": 0.841,
        "note": "グループダンス2エイトづつ 下手前 上手前 下手後ろ 上手後ろ 舞台を四等分で順番に明るくする照明をお願いします",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "neutral",
        "tags": [
          "group",
          "bright"
        ]
      },
      {
        "cueNo": 11,
        "startSec": 168,
        "endSec": 189,
        "progressStart": 0.8615,
        "progressEnd": 0.9692,
        "note": "ラスト 賑やかにおまかせです",
        "inferredSection": "outro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "neutral",
        "tags": [
          "free",
          "bright",
          "ending",
          "outro"
        ]
      },
      {
        "cueNo": 12,
        "startSec": 189,
        "endSec": 195,
        "progressStart": 0.9692,
        "progressEnd": 1,
        "note": "真ん中に集まって ポーズの後 手を振って終わり",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "center",
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_月曜8時マスタークラス",
    "title": "月曜8時マスタークラス",
    "event": "第19回 S.O.P発表会",
    "className": "月曜8時マスタークラス",
    "trackTitle": "flowers-ゆず",
    "durationSec": 182,
    "dancerCount": 11,
    "atmosphere": "だんだん花が咲いていって花びらが舞ったり 枯れそうになったりという ドラマチックな感じ",
    "points": "サスとピンスポの掛け合い 終わったら緞帳をおろす",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-月曜8時マスタークラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 13,
        "progressStart": 0,
        "progressEnd": 0.0714,
        "note": "水滴の音が始まったら青色のサスをフェードイン ギターの音が始まったら緑に変えていく",
        "inferredSection": "intro",
        "lightingPreset": "fade_spot",
        "colorMood": "blue",
        "tags": [
          "sus",
          "dim",
          "blue",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 13,
        "endSec": 28,
        "progressStart": 0.0714,
        "progressEnd": 0.1538,
        "note": "色変化オレンジに",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "yellow"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 28,
        "endSec": 43,
        "progressStart": 0.1538,
        "progressEnd": 0.2363,
        "note": "明るく 黄色系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "bright",
          "yellow"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 43,
        "endSec": 76,
        "progressStart": 0.2363,
        "progressEnd": 0.4176,
        "note": "カラフルに賑やかにお願いします",
        "inferredSection": "verse",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "colorful"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 76,
        "endSec": 82,
        "progressStart": 0.4176,
        "progressEnd": 0.4505,
        "note": "一度 明るさを落として 緑系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "full_bright_warm",
        "colorMood": "green",
        "tags": [
          "dim",
          "bright",
          "green"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 82,
        "endSec": 85,
        "progressStart": 0.4505,
        "progressEnd": 0.467,
        "note": "下手サス 8カウント 3人",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "sus"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 85,
        "endSec": 89,
        "progressStart": 0.467,
        "progressEnd": 0.489,
        "note": "センター 真ん中 若干上手より3人 ピンスポ",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "center"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 89,
        "endSec": 93,
        "progressStart": 0.489,
        "progressEnd": 0.511,
        "note": "下手前方2人 8カウント ピンスポ",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 93,
        "endSec": 97,
        "progressStart": 0.511,
        "progressEnd": 0.533,
        "note": "下手中央と後方から2人センター前方に移動してくる",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "center"
        ]
      },
      {
        "cueNo": 10,
        "startSec": 97,
        "endSec": 111,
        "progressStart": 0.533,
        "progressEnd": 0.6099,
        "note": "明るく 黄色系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "bright",
          "yellow"
        ]
      },
      {
        "cueNo": 11,
        "startSec": 111,
        "endSec": 126,
        "progressStart": 0.6099,
        "progressEnd": 0.6923,
        "note": "曲調変化 ミラーボールで青系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 12,
        "startSec": 126,
        "endSec": 130,
        "progressStart": 0.6923,
        "progressEnd": 0.7143,
        "note": "センターサス 点滅系 赤+ ソロ ピンスポ 8カウントから次にも続く",
        "inferredSection": "drop",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "red",
        "tags": [
          "pin_spot",
          "sus",
          "solo",
          "center",
          "motion",
          "red"
        ]
      },
      {
        "cueNo": 13,
        "startSec": 130,
        "endSec": 144,
        "progressStart": 0.7143,
        "progressEnd": 0.7912,
        "note": "センターサス 色を青 +ソロ ピンスポ 3エイト",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "blue",
        "tags": [
          "pin_spot",
          "sus",
          "solo",
          "center",
          "blue"
        ]
      },
      {
        "cueNo": 14,
        "startSec": 144,
        "endSec": 176,
        "progressStart": 0.7912,
        "progressEnd": 0.967,
        "note": "全体的にカラフルで明るくお願いします",
        "inferredSection": "verse",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "colorful"
        ]
      },
      {
        "cueNo": 15,
        "startSec": 176,
        "endSec": 182,
        "progressStart": 0.967,
        "progressEnd": 1,
        "note": "ラストはカウント7で余韻をだしておわる",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "dim",
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_木曜5時キッズスタートクラス",
    "title": "木曜5時キッズスタートクラス",
    "event": "第19回 S.O.P発表会",
    "className": "木曜5時キッズスタートクラス",
    "trackTitle": "I believe in miracles/for ever love",
    "durationSec": 187,
    "dancerCount": 27,
    "atmosphere": "賑やか 明るい 楽しい",
    "points": "ピンスポあり 2曲目始めと後半",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-木曜5時キッズスタートクラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 71,
        "progressStart": 0,
        "progressEnd": 0.3797,
        "note": "カラフルで賑やかに",
        "inferredSection": "intro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "colorful",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 71,
        "endSec": 82,
        "progressStart": 0.3797,
        "progressEnd": 0.4385,
        "note": "サビ",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "neutral",
        "tags": [
          "chorus"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 82,
        "endSec": 90,
        "progressStart": 0.4385,
        "progressEnd": 0.4813,
        "note": "2曲目 二人センター前 2エイトソロピンスポ",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "solo",
          "center"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 90,
        "endSec": 100,
        "progressStart": 0.4813,
        "progressEnd": 0.5348,
        "note": "3箇所に集まって団結 音は少し小さくなる",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": []
      },
      {
        "cueNo": 5,
        "startSec": 100,
        "endSec": 147,
        "progressStart": 0.5348,
        "progressEnd": 0.7861,
        "note": "明るく 賑やかにカラフル",
        "inferredSection": "verse",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "colorful"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 147,
        "endSec": 155,
        "progressStart": 0.7861,
        "progressEnd": 0.8289,
        "note": "センター前8カウントソロピンスポ センター両サイド2人ソロ8カウント 雰囲気を変えたいです",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "solo",
          "center"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 155,
        "endSec": 178,
        "progressStart": 0.8289,
        "progressEnd": 0.9519,
        "note": "明るく 賑やかにカラフル",
        "inferredSection": "outro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "colorful"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 178,
        "endSec": 187,
        "progressStart": 0.9519,
        "progressEnd": 1,
        "note": "最後真ん中に集まって手を振って終わります",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "center",
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_木曜キッズlockクラス",
    "title": "木曜キッズLOCKクラス",
    "event": "第19回 S.O.P発表会",
    "className": "木曜キッズLOCKクラス",
    "trackTitle": "get away /dreamer",
    "durationSec": 177,
    "dancerCount": 34,
    "atmosphere": "COOLで勢いがある",
    "points": "2曲目からソロ/グループ8カウント4つ/ソロ2エイト/グループ2つ 2曲使い グループの6つ分け",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-木曜キッズLOCKクラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 10,
        "progressStart": 0,
        "progressEnd": 0.0565,
        "note": "イントロ メリハリのある音なので動きを出してください 赤系",
        "inferredSection": "intro",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 10,
        "endSec": 28,
        "progressStart": 0.0565,
        "progressEnd": 0.1582,
        "note": "青系でおまかせです",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "free",
          "blue"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 28,
        "endSec": 36,
        "progressStart": 0.1582,
        "progressEnd": 0.2034,
        "note": "色変化 緑系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "green",
        "tags": [
          "green"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 36,
        "endSec": 58,
        "progressStart": 0.2034,
        "progressEnd": 0.3277,
        "note": "Aメロ 青系にもどります",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 58,
        "endSec": 65,
        "progressStart": 0.3277,
        "progressEnd": 0.3672,
        "note": "1曲目ラスト 赤系でお願いします",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "red",
        "tags": [
          "ending",
          "red",
          "outro"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 65,
        "endSec": 73,
        "progressStart": 0.3672,
        "progressEnd": 0.4124,
        "note": "2曲目 動きを出してください",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": []
      },
      {
        "cueNo": 7,
        "startSec": 73,
        "endSec": 81,
        "progressStart": 0.4124,
        "progressEnd": 0.4576,
        "note": "ソロ ピンスポ センターヘソ 2エイト",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "solo",
          "center"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 81,
        "endSec": 96,
        "progressStart": 0.4576,
        "progressEnd": 0.5424,
        "note": "賑やかに 青 黄色 赤を混ぜて交互につける感じ",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "bright",
          "red"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 96,
        "endSec": 110,
        "progressStart": 0.5424,
        "progressEnd": 0.6215,
        "note": "集まって音が静かになるので青系でおまかせです",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "free",
          "blue"
        ]
      },
      {
        "cueNo": 10,
        "startSec": 110,
        "endSec": 140,
        "progressStart": 0.6215,
        "progressEnd": 0.791,
        "note": "グループダンス8カウント4つ。ソロ2エイト。グループ2つ /センター後ろ、センター前、上手後ろ、下手後ろ、ソロセンター、上手前、下手前",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "neutral",
        "tags": [
          "solo",
          "center",
          "group"
        ]
      },
      {
        "cueNo": 11,
        "startSec": 140,
        "endSec": 170,
        "progressStart": 0.791,
        "progressEnd": 0.9605,
        "note": "ラストパート 賑やかにお願いします",
        "inferredSection": "outro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "neutral",
        "tags": [
          "bright",
          "ending",
          "outro"
        ]
      },
      {
        "cueNo": 12,
        "startSec": 170,
        "endSec": 177,
        "progressStart": 0.9605,
        "progressEnd": 1,
        "note": "最後は右手を挙げて余韻を残して終わりです",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "dim",
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_木曜7時hiphopステップアップクラス",
    "title": "木曜7時HIPHOPステップアップクラス",
    "event": "第19回 S.O.P発表会",
    "className": "木曜7時HIPHOPステップアップクラス",
    "trackTitle": "hana-ROSE",
    "durationSec": 196,
    "dancerCount": 36,
    "atmosphere": "強い かっこいい 綺麗 自信に満ちている",
    "points": "ソロ2箇所 半分づつ照らすところあり サビ3回や強弱を表現して頂ければと思います",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-木曜7時HIPHOPステップアップクラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 8,
        "progressStart": 0,
        "progressEnd": 0.0408,
        "note": "イントロ センターサスとSSを使って雰囲気を出す 赤系",
        "inferredSection": "intro",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "red",
        "tags": [
          "sus",
          "ss",
          "center",
          "red",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 8,
        "endSec": 24,
        "progressStart": 0.0408,
        "progressEnd": 0.1224,
        "note": "色追加 赤と青",
        "inferredSection": "intro",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 24,
        "endSec": 39,
        "progressStart": 0.1224,
        "progressEnd": 0.199,
        "note": "青と緑でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 39,
        "endSec": 54,
        "progressStart": 0.199,
        "progressEnd": 0.2755,
        "note": "サビ ムービングを使って動きを出しつつ 赤系で賑やかに",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "red",
        "tags": [
          "motion",
          "bright",
          "red",
          "chorus"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 54,
        "endSec": 70,
        "progressStart": 0.2755,
        "progressEnd": 0.3571,
        "note": "2エイト下手 その後2エイト上手 半分だけ照らす照明をお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": []
      },
      {
        "cueNo": 6,
        "startSec": 70,
        "endSec": 77,
        "progressStart": 0.3571,
        "progressEnd": 0.3929,
        "note": "ソロ センターヘソ前 2エイト ゆりな",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "neutral",
        "tags": [
          "solo",
          "center"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 77,
        "endSec": 85,
        "progressStart": 0.3929,
        "progressEnd": 0.4337,
        "note": "サビ前 青と緑でお願いします",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "blue",
        "tags": [
          "blue",
          "chorus"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 85,
        "endSec": 101,
        "progressStart": 0.4337,
        "progressEnd": 0.5153,
        "note": "サビ2 ムービングを使って動きを出しつつ 赤系で賑やかに",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "red",
        "tags": [
          "motion",
          "bright",
          "red",
          "chorus"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 101,
        "endSec": 116,
        "progressStart": 0.5153,
        "progressEnd": 0.5918,
        "note": "雰囲気変化をお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": []
      },
      {
        "cueNo": 10,
        "startSec": 116,
        "endSec": 131,
        "progressStart": 0.5918,
        "progressEnd": 0.6684,
        "note": "雰囲気変化 ペアパート 少し暗めでSSを目立たせてください",
        "inferredSection": "verse",
        "lightingPreset": "fade_spot",
        "colorMood": "dim",
        "tags": [
          "ss",
          "dim"
        ]
      },
      {
        "cueNo": 11,
        "startSec": 131,
        "endSec": 139,
        "progressStart": 0.6684,
        "progressEnd": 0.7092,
        "note": "ソロ 下手前 2エイト ピンスポ あやね",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "solo"
        ]
      },
      {
        "cueNo": 12,
        "startSec": 139,
        "endSec": 150,
        "progressStart": 0.7092,
        "progressEnd": 0.7653,
        "note": "刀の効果音が入ってきます 黄色系",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "yellow"
        ]
      },
      {
        "cueNo": 13,
        "startSec": 150,
        "endSec": 166,
        "progressStart": 0.7653,
        "progressEnd": 0.8469,
        "note": "サビ3 ムービングを使って動きを出しつつ 赤系で賑やかに",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "red",
        "tags": [
          "motion",
          "bright",
          "red",
          "chorus"
        ]
      },
      {
        "cueNo": 14,
        "startSec": 166,
        "endSec": 182,
        "progressStart": 0.8469,
        "progressEnd": 0.9286,
        "note": "ラスト 赤系でおまかせです",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "red",
        "tags": [
          "free",
          "ending",
          "red",
          "outro"
        ]
      },
      {
        "cueNo": 15,
        "startSec": 182,
        "endSec": 196,
        "progressStart": 0.9286,
        "progressEnd": 1,
        "note": "カウント2で余韻を出して終わります",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "dim",
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_木曜フリースタイルクラス",
    "title": "木曜フリースタイルクラス",
    "event": "第19回 S.O.P発表会",
    "className": "木曜フリースタイルクラス",
    "trackTitle": "riot in lagos / astro",
    "durationSec": 184,
    "dancerCount": 15,
    "atmosphere": "宇宙空間や他の世界のような感じ",
    "points": "2曲目の入りの場面転換の見せ方",
    "pinSpot": false,
    "sourceFile": "data/lighting-plans/2025-19th-木曜フリースタイルクラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 8,
        "progressStart": 0,
        "progressEnd": 0.0435,
        "note": "宇宙っぽい感じの世界観を出したい",
        "inferredSection": "intro",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 8,
        "endSec": 23,
        "progressStart": 0.0435,
        "progressEnd": 0.125,
        "note": "BEATが入るので白の明かりで雰囲気を出してください",
        "inferredSection": "intro",
        "lightingPreset": "guide_mono",
        "colorMood": "white",
        "tags": [
          "white"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 23,
        "endSec": 38,
        "progressStart": 0.125,
        "progressEnd": 0.2065,
        "note": "色変化 青系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 38,
        "endSec": 68,
        "progressStart": 0.2065,
        "progressEnd": 0.3696,
        "note": "色変化 黄色系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "yellow"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 68,
        "endSec": 83,
        "progressStart": 0.3696,
        "progressEnd": 0.4511,
        "note": "色変化 赤系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 83,
        "endSec": 100,
        "progressStart": 0.4511,
        "progressEnd": 0.5435,
        "note": "色変化 紫系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "purple",
        "tags": [
          "purple"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 100,
        "endSec": 104,
        "progressStart": 0.5435,
        "progressEnd": 0.5652,
        "note": "だんだん暗くしてください",
        "inferredSection": "verse",
        "lightingPreset": "fade_spot",
        "colorMood": "dim",
        "tags": [
          "dim"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 104,
        "endSec": 119,
        "progressStart": 0.5652,
        "progressEnd": 0.6467,
        "note": "曲変化 青系勢いを出す点滅でだんだん遅くなります",
        "inferredSection": "drop",
        "lightingPreset": "strobe_flash",
        "colorMood": "blue",
        "tags": [
          "motion",
          "buildup",
          "blue"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 119,
        "endSec": 134,
        "progressStart": 0.6467,
        "progressEnd": 0.7283,
        "note": "2曲目 黄色系で エネルギッシュにお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "yellow"
        ]
      },
      {
        "cueNo": 10,
        "startSec": 134,
        "endSec": 149,
        "progressStart": 0.7283,
        "progressEnd": 0.8098,
        "note": "青色と緑でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 11,
        "startSec": 149,
        "endSec": 164,
        "progressStart": 0.8098,
        "progressEnd": 0.8913,
        "note": "黄色系でエネルギッシュにお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "yellow"
        ]
      },
      {
        "cueNo": 12,
        "startSec": 164,
        "endSec": 179,
        "progressStart": 0.8913,
        "progressEnd": 0.9728,
        "note": "カラフルで賑やかにお願いします",
        "inferredSection": "outro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "colorful"
        ]
      },
      {
        "cueNo": 13,
        "startSec": 179,
        "endSec": 184,
        "progressStart": 0.9728,
        "progressEnd": 1,
        "note": "最後はカウント1でポーズプラス余韻を見せます",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "dim",
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_火曜6時初中級クラス",
    "title": "火曜6時初中級クラス",
    "event": "第19回 S.O.P発表会",
    "className": "火曜6時初中級クラス",
    "trackTitle": "Motownphilly-ボーイズIIメン",
    "durationSec": 185,
    "dancerCount": 29,
    "atmosphere": "1970年代のミドルスクールHIPHOP かっこいい",
    "points": "ピンスポあり センターヘソ そうすけ センター前 ふうか グループあり",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-火曜6時初中級クラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 5,
        "progressStart": 0,
        "progressEnd": 0.027,
        "note": "初めは曲の始まりと同時にセンター後ろココにピンスポを当てる",
        "inferredSection": "intro",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "center",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 5,
        "endSec": 25,
        "progressStart": 0.027,
        "progressEnd": 0.1351,
        "note": "イントロ部分 明るくカラフルでお願いします",
        "inferredSection": "intro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "colorful",
          "intro"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 25,
        "endSec": 45,
        "progressStart": 0.1351,
        "progressEnd": 0.2432,
        "note": "青系でおまかせです",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "free",
          "blue"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 45,
        "endSec": 50,
        "progressStart": 0.2432,
        "progressEnd": 0.2703,
        "note": "ピンスポ センターヘソ そうすけ 1✖️8プラス4カウント",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "center"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 50,
        "endSec": 65,
        "progressStart": 0.2703,
        "progressEnd": 0.3514,
        "note": "青系でおまかせです",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "free",
          "blue"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 65,
        "endSec": 74,
        "progressStart": 0.3514,
        "progressEnd": 0.4,
        "note": "センター前 ふうかソロ 2✖️8",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "neutral",
        "tags": [
          "solo",
          "center"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 74,
        "endSec": 93,
        "progressStart": 0.4,
        "progressEnd": 0.5027,
        "note": "ムービングで動きを出してください",
        "inferredSection": "verse",
        "lightingPreset": "strobe_flash",
        "colorMood": "neutral",
        "tags": [
          "motion"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 93,
        "endSec": 135,
        "progressStart": 0.5027,
        "progressEnd": 0.7297,
        "note": "グループダンス サス2✖️8づつ センター 下手 上手 センター 下手の順",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "neutral",
        "tags": [
          "sus",
          "center",
          "group"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 135,
        "endSec": 151,
        "progressStart": 0.7297,
        "progressEnd": 0.8162,
        "note": "音のトーンが下がるので、照明も雰囲気を出してください",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": []
      },
      {
        "cueNo": 10,
        "startSec": 151,
        "endSec": 182,
        "progressStart": 0.8162,
        "progressEnd": 0.9838,
        "note": "ラストにかけて賑やかな感じでお願いします",
        "inferredSection": "outro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "neutral",
        "tags": [
          "bright",
          "ending",
          "outro"
        ]
      },
      {
        "cueNo": 11,
        "startSec": 182,
        "endSec": 185,
        "progressStart": 0.9838,
        "progressEnd": 1,
        "note": "ラストはカウント6で真ん中に寄ってきてポーズ",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "center",
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_火曜中級クラス",
    "title": "火曜中級クラス",
    "event": "第19回 S.O.P発表会",
    "className": "火曜中級クラス",
    "trackTitle": "HOWL/imazu ayumu",
    "durationSec": 191,
    "dancerCount": 25,
    "atmosphere": "クール",
    "points": "ソロピンスポ2箇所 グループ 5つ 1曲使い",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-火曜中級クラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 9,
        "progressStart": 0,
        "progressEnd": 0.0471,
        "note": "イントロ 赤系でトランペットと警報の雰囲気",
        "inferredSection": "intro",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 9,
        "endSec": 39,
        "progressStart": 0.0471,
        "progressEnd": 0.2042,
        "note": "Aメロ 緑系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "green",
        "tags": [
          "green"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 39,
        "endSec": 47,
        "progressStart": 0.2042,
        "progressEnd": 0.2461,
        "note": "曲調変化 赤系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 47,
        "endSec": 64,
        "progressStart": 0.2461,
        "progressEnd": 0.3351,
        "note": "サビ 黄色系でお願いします",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "yellow",
        "tags": [
          "yellow",
          "chorus"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 64,
        "endSec": 80,
        "progressStart": 0.3351,
        "progressEnd": 0.4188,
        "note": "2番 緑系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "green",
        "tags": [
          "green"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 80,
        "endSec": 94,
        "progressStart": 0.4188,
        "progressEnd": 0.4921,
        "note": "曲調変化 赤系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 94,
        "endSec": 100,
        "progressStart": 0.4921,
        "progressEnd": 0.5236,
        "note": "ソロセンター前 みお 1✖️8➕4カウント",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "neutral",
        "tags": [
          "solo",
          "center"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 102,
        "endSec": 117,
        "progressStart": 0.534,
        "progressEnd": 0.6126,
        "note": "グループ サス 2エイト センター&上手",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "neutral",
        "tags": [
          "sus",
          "center",
          "group"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 117,
        "endSec": 125,
        "progressStart": 0.6126,
        "progressEnd": 0.6545,
        "note": "2チーム目が終わったら間の2エイトみんなで踊る",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": []
      },
      {
        "cueNo": 10,
        "startSec": 125,
        "endSec": 140,
        "progressStart": 0.6545,
        "progressEnd": 0.733,
        "note": "グループ サス 2エイト センター&下手",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "neutral",
        "tags": [
          "sus",
          "center",
          "group"
        ]
      },
      {
        "cueNo": 11,
        "startSec": 140,
        "endSec": 157,
        "progressStart": 0.733,
        "progressEnd": 0.822,
        "note": "ソロ 上手前方 さやか 2エイト その後 サスグループ2エイトセンター",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "neutral",
        "tags": [
          "sus",
          "solo",
          "center",
          "group"
        ]
      },
      {
        "cueNo": 12,
        "startSec": 157,
        "endSec": 188,
        "progressStart": 0.822,
        "progressEnd": 0.9843,
        "note": "ラスト 合わせ カラフルでおまかせです",
        "inferredSection": "outro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "free",
          "bright",
          "ending",
          "colorful",
          "outro"
        ]
      },
      {
        "cueNo": 13,
        "startSec": 188,
        "endSec": 191,
        "progressStart": 0.9843,
        "progressEnd": 1,
        "note": "ある程度真ん中に集まって余韻を出して終わります",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "center",
          "dim",
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_火曜8時上級クラス",
    "title": "火曜8時上級クラス",
    "event": "第19回 S.O.P発表会",
    "className": "火曜8時上級クラス",
    "trackTitle": "ライラック",
    "durationSec": 196,
    "dancerCount": 11,
    "atmosphere": "青春! 抑揚が色々とあるので場面場面で色を変える",
    "points": "初めのピンスポは3人を入れるので大きめで2つ使う 後半は時間が短いので注意 半分づつ明かりをつけるところあり",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-火曜8時上級クラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 14,
        "progressStart": 0,
        "progressEnd": 0.0714,
        "note": "イントロ ギター音 強め 黄色系",
        "inferredSection": "intro",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "yellow",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 14,
        "endSec": 26,
        "progressStart": 0.0714,
        "progressEnd": 0.1327,
        "note": "ギターが激しくなるのでそれに合わせてムービングもお願いします",
        "inferredSection": "drop",
        "lightingPreset": "strobe_flash",
        "colorMood": "neutral",
        "tags": [
          "motion"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 26,
        "endSec": 52,
        "progressStart": 0.1327,
        "progressEnd": 0.2653,
        "note": "Aメロ 紫系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "purple",
        "tags": [
          "purple"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 52,
        "endSec": 65,
        "progressStart": 0.2653,
        "progressEnd": 0.3316,
        "note": "曲調変化 雰囲気を変えてください",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": []
      },
      {
        "cueNo": 5,
        "startSec": 65,
        "endSec": 90,
        "progressStart": 0.3316,
        "progressEnd": 0.4592,
        "note": "サビ 明るくカラフルにお願いします",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "colorful",
          "chorus"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 90,
        "endSec": 103,
        "progressStart": 0.4592,
        "progressEnd": 0.5255,
        "note": "ピンスポ センター前3人",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "center"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 103,
        "endSec": 113,
        "progressStart": 0.5255,
        "progressEnd": 0.5765,
        "note": "SSも使って下手半分13カウント明るくその後上手13カウント",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "ss",
          "bright"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 113,
        "endSec": 124,
        "progressStart": 0.5765,
        "progressEnd": 0.6327,
        "note": "SSをベースに全体もある程度明るく 青系",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "ss",
          "bright",
          "blue"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 124,
        "endSec": 139,
        "progressStart": 0.6327,
        "progressEnd": 0.7092,
        "note": "曲調変化 紫系でお願いいます。",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "purple",
        "tags": [
          "purple"
        ]
      },
      {
        "cueNo": 10,
        "startSec": 139,
        "endSec": 165,
        "progressStart": 0.7092,
        "progressEnd": 0.8418,
        "note": "曲変化 盛り上がってくるので赤系でお願いします",
        "inferredSection": "drop",
        "lightingPreset": "strobe_flash",
        "colorMood": "red",
        "tags": [
          "bright",
          "red"
        ]
      },
      {
        "cueNo": 11,
        "startSec": 165,
        "endSec": 177,
        "progressStart": 0.8418,
        "progressEnd": 0.9031,
        "note": "曲変化 エンディングっぽい感じ 明るめでカラフルに",
        "inferredSection": "outro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "ending",
          "colorful",
          "outro"
        ]
      },
      {
        "cueNo": 12,
        "startSec": 177,
        "endSec": 179,
        "progressStart": 0.9031,
        "progressEnd": 0.9133,
        "note": "ピンスポ4カウント 七瀬センターヘソ付近",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "center"
        ]
      },
      {
        "cueNo": 13,
        "startSec": 179,
        "endSec": 191,
        "progressStart": 0.9133,
        "progressEnd": 0.9745,
        "note": "ラスト合わせ ギターの音に変化 黄色と紫を混ぜてください",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "yellow",
        "tags": [
          "ending",
          "yellow",
          "outro"
        ]
      },
      {
        "cueNo": 14,
        "startSec": 191,
        "endSec": 196,
        "progressStart": 0.9745,
        "progressEnd": 1,
        "note": "ラストは横一列で前に出てきて終わりです",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_金曜_キッズステップアップクラス",
    "title": "金曜 キッズステップアップクラス",
    "event": "第19回 S.O.P発表会",
    "className": "金曜 キッズステップアップクラス",
    "trackTitle": "百花繚乱",
    "durationSec": 180,
    "dancerCount": 32,
    "atmosphere": "元気 華やか 賑やか",
    "points": "サスを3箇所照らす部分 グループダンス4分割の順番とソロ",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-金曜_キッズステップアップクラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 13,
        "progressStart": 0,
        "progressEnd": 0.0722,
        "note": "イントロ カラフルで明るく",
        "inferredSection": "intro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "colorful",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 13,
        "endSec": 19,
        "progressStart": 0.0722,
        "progressEnd": 0.1056,
        "note": "タッタタラッタ1 赤でお願いします",
        "inferredSection": "intro",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 19,
        "endSec": 32,
        "progressStart": 0.1056,
        "progressEnd": 0.1778,
        "note": "紫でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "purple",
        "tags": [
          "purple"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 32,
        "endSec": 57,
        "progressStart": 0.1778,
        "progressEnd": 0.3167,
        "note": "黄色と赤でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 57,
        "endSec": 64,
        "progressStart": 0.3167,
        "progressEnd": 0.3556,
        "note": "タッタタラッタ2緑でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "green",
        "tags": [
          "green"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 64,
        "endSec": 89,
        "progressStart": 0.3556,
        "progressEnd": 0.4944,
        "note": "青でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 89,
        "endSec": 107,
        "progressStart": 0.4944,
        "progressEnd": 0.5944,
        "note": "サスを3箇所つけて移動に合わせて全体に戻してください 照明はムービングも入れてカラフルで賑やかにお願いします",
        "inferredSection": "verse",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "sus",
          "motion",
          "bright",
          "colorful"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 107,
        "endSec": 121,
        "progressStart": 0.5944,
        "progressEnd": 0.6722,
        "note": "真ん中に集まる 音のトーンが落ちるので 青系で雰囲気を出してください",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "center",
          "blue"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 121,
        "endSec": 134,
        "progressStart": 0.6722,
        "progressEnd": 0.7444,
        "note": "広がる/色も黄色系でだんだん明るくしていってください",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "yellow",
        "tags": [
          "bright",
          "yellow"
        ]
      },
      {
        "cueNo": 10,
        "startSec": 134,
        "endSec": 160,
        "progressStart": 0.7444,
        "progressEnd": 0.8889,
        "note": "グループソロ8カウントづつ 4分割の照明で順番に照らしてください 上手後ろ 下手前 上手前 下手後ろ 上手後ろ 下手前 上手前 下手後ろ",
        "inferredSection": "se_trigger",
        "lightingPreset": "color_switch",
        "colorMood": "neutral",
        "tags": [
          "solo",
          "group"
        ]
      },
      {
        "cueNo": 11,
        "startSec": 160,
        "endSec": 166,
        "progressStart": 0.8889,
        "progressEnd": 0.9222,
        "note": "ソロピンスポ-8カウント センター前 下手側 エバ→上手側 ハナ",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "solo",
          "center"
        ]
      },
      {
        "cueNo": 12,
        "startSec": 166,
        "endSec": 177,
        "progressStart": 0.9222,
        "progressEnd": 0.9833,
        "note": "ラスト合わせ カラフルで明るく",
        "inferredSection": "outro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "ending",
          "colorful",
          "outro"
        ]
      },
      {
        "cueNo": 13,
        "startSec": 177,
        "endSec": 180,
        "progressStart": 0.9833,
        "progressEnd": 1,
        "note": "カウント5で余韻を出して終わります",
        "inferredSection": "outro",
        "lightingPreset": "fade_spot",
        "colorMood": "neutral",
        "tags": [
          "dim",
          "ending",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2025_19th_金曜8時lockクラス",
    "title": "金曜8時LOCKクラス",
    "event": "第19回 S.O.P発表会",
    "className": "金曜8時LOCKクラス",
    "trackTitle": "Soul with a capital S",
    "durationSec": 186,
    "dancerCount": 22,
    "atmosphere": "勢いがあって エネルギッシュ テンション高め",
    "points": "ソロ サスから前に移動",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2025-19th-金曜8時LOCKクラス.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 8,
        "progressStart": 0,
        "progressEnd": 0.043,
        "note": "スタートは音にはめつつバックライト➕SSで見せる",
        "inferredSection": "intro",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "ss",
          "backlight",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 8,
        "endSec": 37,
        "progressStart": 0.043,
        "progressEnd": 0.1989,
        "note": "勢いよく広がっていく 赤、黄色系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "strobe_flash",
        "colorMood": "red",
        "tags": [
          "buildup",
          "red"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 37,
        "endSec": 47,
        "progressStart": 0.1989,
        "progressEnd": 0.2527,
        "note": "青、緑系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 47,
        "endSec": 60,
        "progressStart": 0.2527,
        "progressEnd": 0.3226,
        "note": "サビ 赤、黄色系でお願いします",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "red",
        "tags": [
          "red",
          "chorus"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 60,
        "endSec": 68,
        "progressStart": 0.3226,
        "progressEnd": 0.3656,
        "note": "サビ2 黄色系でお願いします",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "yellow",
        "tags": [
          "yellow",
          "chorus"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 68,
        "endSec": 82,
        "progressStart": 0.3656,
        "progressEnd": 0.4409,
        "note": "赤系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 82,
        "endSec": 92,
        "progressStart": 0.4409,
        "progressEnd": 0.4946,
        "note": "青、緑系でお願いします",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 92,
        "endSec": 105,
        "progressStart": 0.4946,
        "progressEnd": 0.5645,
        "note": "サビ 赤、黄色系でお願いします",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "red",
        "tags": [
          "red",
          "chorus"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 105,
        "endSec": 112,
        "progressStart": 0.5645,
        "progressEnd": 0.6022,
        "note": "ソロセンター前 ピンスポ 2エイト クレア",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "solo",
          "center"
        ]
      },
      {
        "cueNo": 10,
        "startSec": 112,
        "endSec": 136,
        "progressStart": 0.6022,
        "progressEnd": 0.7312,
        "note": "グループダンス2エイト,サスの位置から始まって前に出てくる サスとピンスポで追う 上手 下手 センター",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "sus",
          "center",
          "group"
        ]
      },
      {
        "cueNo": 11,
        "startSec": 136,
        "endSec": 152,
        "progressStart": 0.7312,
        "progressEnd": 0.8172,
        "note": "サビ 赤、黄色系でお願いします",
        "inferredSection": "chorus",
        "lightingPreset": "full_bright_warm",
        "colorMood": "red",
        "tags": [
          "red",
          "chorus"
        ]
      },
      {
        "cueNo": 12,
        "startSec": 152,
        "endSec": 157,
        "progressStart": 0.8172,
        "progressEnd": 0.8441,
        "note": "音ハメ➕音が小さくなります バックライトからのSS",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "neutral",
        "tags": [
          "ss",
          "backlight"
        ]
      },
      {
        "cueNo": 13,
        "startSec": 157,
        "endSec": 177,
        "progressStart": 0.8441,
        "progressEnd": 0.9516,
        "note": "最後の合わせ カラフルで明るくお願いします",
        "inferredSection": "outro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "bright",
          "colorful",
          "outro"
        ]
      }
    ]
  },
  {
    "id": "2023_mini_am12_birthday_time",
    "title": "月曜8時HIPHOPマスター birthday & TIME",
    "event": "2023年 第1回 S.O.Pミニ発表会",
    "className": "月曜8時ＨＩＰＨＯＰマスタークラス",
    "trackTitle": "birthday & TIME",
    "durationSec": 180,
    "dancerCount": 7,
    "atmosphere": "1曲目 雰囲気のあるカッコよさ 2曲目 明るく楽しい感じ",
    "points": "1曲目の中盤にソロパートあり 後半 ラスト前ピンスポあり",
    "pinSpot": true,
    "sourceFile": "data/lighting-plans/2023-mini-recital-am12-birthday-TIME.csv",
    "cues": [
      {
        "cueNo": 1,
        "startSec": 0,
        "endSec": 7,
        "progressStart": 0,
        "progressEnd": 0.0389,
        "note": "始めはSSとバックライトで雰囲気を出してスタート",
        "inferredSection": "intro",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "ss",
          "backlight",
          "intro"
        ]
      },
      {
        "cueNo": 2,
        "startSec": 7,
        "endSec": 45,
        "progressStart": 0.0389,
        "progressEnd": 0.25,
        "note": "青系をすこし入れる",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "blue",
        "tags": [
          "blue"
        ]
      },
      {
        "cueNo": 3,
        "startSec": 45,
        "endSec": 75,
        "progressStart": 0.25,
        "progressEnd": 0.4167,
        "note": "青と赤と緑を混ぜる",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "red"
        ]
      },
      {
        "cueNo": 4,
        "startSec": 75,
        "endSec": 91,
        "progressStart": 0.4167,
        "progressEnd": 0.5056,
        "note": "8カウントずつ 真ん中 下手 真ん中 上手の順にピンスポ",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "center"
        ]
      },
      {
        "cueNo": 5,
        "startSec": 91,
        "endSec": 98,
        "progressStart": 0.5056,
        "progressEnd": 0.5444,
        "note": "白系で雰囲気を出す",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "white",
        "tags": [
          "white"
        ]
      },
      {
        "cueNo": 6,
        "startSec": 98,
        "endSec": 123,
        "progressStart": 0.5444,
        "progressEnd": 0.6833,
        "note": "2曲目 赤 黄色を使って明るめに切り替える",
        "inferredSection": "verse",
        "lightingPreset": "guide_mono",
        "colorMood": "red",
        "tags": [
          "bright",
          "red"
        ]
      },
      {
        "cueNo": 7,
        "startSec": 123,
        "endSec": 139,
        "progressStart": 0.6833,
        "progressEnd": 0.7722,
        "note": "2エイト 二人 2エイト リョウタソロ ピンスポでセンター",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "solo",
          "center"
        ]
      },
      {
        "cueNo": 8,
        "startSec": 139,
        "endSec": 148,
        "progressStart": 0.7722,
        "progressEnd": 0.8222,
        "note": "時計の音 色を落として 明るさも少し落とす",
        "inferredSection": "verse",
        "lightingPreset": "full_bright_warm",
        "colorMood": "neutral",
        "tags": [
          "dim",
          "bright"
        ]
      },
      {
        "cueNo": 9,
        "startSec": 148,
        "endSec": 164,
        "progressStart": 0.8222,
        "progressEnd": 0.9111,
        "note": "ソロ 4エイト ピンスポ 真ん中",
        "inferredSection": "se_trigger",
        "lightingPreset": "pin_spot_dark",
        "colorMood": "neutral",
        "tags": [
          "pin_spot",
          "solo",
          "center"
        ]
      },
      {
        "cueNo": 10,
        "startSec": 164,
        "endSec": 180,
        "progressStart": 0.9111,
        "progressEnd": 1,
        "note": "カラフルで 賑やかに おまかせです",
        "inferredSection": "outro",
        "lightingPreset": "full_bright_warm",
        "colorMood": "colorful",
        "tags": [
          "free",
          "bright",
          "colorful",
          "outro"
        ]
      }
    ]
  }
];
