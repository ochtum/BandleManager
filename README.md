<p align="left">
  <a href="README_en.md"><img src="https://img.shields.io/badge/English Mode-blue.svg" alt="English"></a>
  <a href="README.md"><img src="https://img.shields.io/badge/日本語 モード-red.svg" alt="日本語"></a>
</p>

# Bandle Manager

VS Code workspace へ適用したい内容を、事前に「バンドル」として登録して再利用するVS Code拡張機能です。

## できること

- バンドル登録
  - ワークスペース設定 (`.vscode/settings.json`) の登録（必要なキーのみ選択して登録することも可能です）
  - ワークスペースへコピーしたいファイル/フォルダ（ファイル追加・フォルダ追加を分けて複数回選択可能）の登録
  - 適用時にワークスペースへ追加するフォルダを1つ登録（保存済みワークスペース指定の前に確認）
  - 保存済みワークスペース (`.code-workspace`ファイルを指定する)の登録
- バンドル適用
  - 設定をワークスペース設定へマージする
  - ファイル/フォルダをワークスペースへコピーする
  - 指定フォルダを現在のワークスペースへ追加する
  - 保存済みワークスペースを開く

## 使い方（サイドバーUI）

1. 左のアクティビティバーに表示される `Bandle Manager` アイコンをクリック
2. `Bandle Manager` で操作
   - `登録`: 新しいバンドルを作成
   - `一覧テキスト`: テキスト一覧を別タブ表示
   - `更新`: サイドバー再読み込み
- 各バンドルごとの操作
   - `適用`: 各バンドルの適用ボタン
   - `削除`: 各バンドルの削除ボタン

## コマンドパレットでも操作可能

- `Bandle Manager: Register Bundle`
- `Bandle Manager: Apply Bundle`
- `Bandle Manager: Delete Bundle`
- `Bandle Manager: List Bundles`

## 補足

- バンドルデータは VS Code の `globalStorage` に保存されます。
- 適用時の設定マージは浅いマージです。同一キーがある場合、バンドル側の値で上書きします。
