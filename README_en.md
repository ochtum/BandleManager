<p align="left">
  <a href="README_en.md"><img src="https://img.shields.io/badge/English Mode-blue.svg" alt="English"></a>
  <a href="README.md"><img src="https://img.shields.io/badge/日本語 モード-red.svg" alt="日本語"></a>
</p>

# Bandle Manager

Bandle Manager is a VS Code extension that lets you pre-register reusable "bundles" of settings and resources you want to apply to a VS Code workspace.

## What You Can Do

- Register bundles
  - Register workspace settings (`.vscode/settings.json`) (you can also select only specific keys to register)
  - Register files/folders you want to copy into a workspace (you can select multiple times, separately for file additions and folder additions)
  - Register one folder to add to the workspace at apply time (confirmation appears before selecting a saved workspace)
  - Register a saved workspace (by specifying a `.code-workspace` file)
- Apply bundles
  - Merge settings into workspace settings
  - Copy files/folders into the workspace
  - Add the specified folder to the current workspace
  - Open the saved workspace

## How to Use (Sidebar UI)

1. Click the `Bandle Manager` icon in the left activity bar.
2. Use the controls in `Bandle Manager`.
   - `登録`: Create a new bundle
   - `一覧テキスト`: Show the bundle list as text in a separate tab
   - `更新`: Reload the sidebar
- Per-bundle actions
   - `適用`: Apply button for each bundle
   - `削除`: Delete button for each bundle

## Also Available from the Command Palette

- `Bandle Manager: Register Bundle`
- `Bandle Manager: Apply Bundle`
- `Bandle Manager: Delete Bundle`
- `Bandle Manager: List Bundles`

## Notes

- Bundle data is stored in VS Code `globalStorage`.
- Settings merge on apply is shallow. If the same key exists, the bundle value overwrites the existing value.
