<p align="left">
  <a href="README_en.md"><img src="https://img.shields.io/badge/English Mode-blue.svg" alt="English"></a>
  <a href="README.md"><img src="https://img.shields.io/badge/日本語 モード-red.svg" alt="日本語"></a>
</p>

# Bandle Manager

This VS Code extension lets you pre-register content you want to apply to a VS Code workspace as reusable "bundles."

![image](/image/00001.jpg)

## Features

- Bundle registration
  - Register workspace settings (`.vscode/settings.json`) (you can also register only selected keys)
  - Register files/folders you want to copy to a workspace (you can select multiple times, separately for adding files and adding folders)
  - Register one folder to add to the workspace at apply time (confirmation appears before selecting a saved workspace)
  - Register a saved workspace (specify a `.code-workspace` file)
- Bundle application
  - Merge settings into workspace settings
  - Copy files/folders into the workspace
  - Add the specified folder to the current workspace
  - Open the saved workspace

## Installation Steps

1. In VS Code, open the Extensions view and click the three-dot menu (`...`).
2. Click `Install from VSIX...`.
3. In the file picker, select the VSIX file (`bandle-manager-X.X.X.vsix`) and click `Install`.

## How to Use (Sidebar UI)

1. Click the `Bandle Manager` icon in the left activity bar.
2. Operate from `Bandle Manager`.
   - `登録`: Create a new bundle
   - `一覧テキスト`: Show the bundle list as text in a separate tab
   - `更新`: Reload the sidebar
- Per-bundle operations
  - `適用`: Apply each bundle
  - `削除`: Delete each bundle

## Also Available from the Command Palette

- `Bandle Manager: Register Bundle`
- `Bandle Manager: Apply Bundle`
- `Bandle Manager: Delete Bundle`
- `Bandle Manager: List Bundles`

## Files Provided for Users

For people using this VS Code extension, we provide the following folders/settings. Feel free to use them.

- `css/`
  - Styles for Markdown preview (example: `css/github-markdown-preview.css`)
- `assets/`
  - Image/SVG assets used in README and other files (example: `assets/dividers/*.svg`). At the moment, only horizontal divider assets are included.
- `.vscode/`
  - Workspace settings (example: `markdown.styles` in `.vscode/settings.json`)

By including the `css` folder, `assets` folder, and config files under `.vscode` when registering a bundle in `Bandle Manager`, you can distribute the same structure to target workspaces in one step.

## Notes

- Bundle data is stored in VS Code `globalStorage`.
- Settings are merged shallowly on apply. If the same key exists, the bundle value overwrites the existing value.

## ❗This project is licensed under the MIT License. See the LICENSE file for details.
