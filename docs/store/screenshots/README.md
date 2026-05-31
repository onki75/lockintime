# ストア用グラフィック素材

`npm run build` 後の dist/ を読み込んだ実画面を Playwright で自動撮影したもの。

## アップロードする画像（スクリーンショット枠）
すべて 1280×800（Chrome ウェブストア規格）。推奨順:

1. **options.png** — ブロックリスト本体（ダッシュボード）。一番の主役
2. **screen-time.png** — スクリーンタイム目標＋週間レポート
3. **blocked.png** — 実際のブロック画面
4. **popup-framed.png** — ツールバーのポップアップ（背景に中央配置して規格化済み）

## その他
- **store-icon-128.png** — ストア用アイテムアイコン（128×128）
- **popup.png** — ポップアップ実寸（400×600）。規格外なので直接アップロード不可。`popup-framed.png` を使う

## 再生成方法
撮影スクリプトは `/tmp/shoot2.mjs`（options/popup）, `/tmp/shoot3.mjs`（screen-time）。
ダミーのブロックリストをシードしてからオンボーディングをスキップして撮影している。
UI 変更後に撮り直す場合はこれらを再実行し、popup は ImageMagick で 1280×800 背景に合成する:

```bash
magick -size 1280x800 gradient:'#eef4ff-#dbe7ff' bg.png
magick popup.png \( +clone -background black -shadow 40x12+0+8 \) +swap -background none -layers merge +repage popup-shadow.png
magick bg.png popup-shadow.png -gravity center -composite popup-framed.png
```
