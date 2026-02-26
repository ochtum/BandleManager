const vscode = require("vscode");
const path = require("path");
const fs = require("fs/promises");

const STORAGE_KEY = "bundles.v1";

function nowIso() {
  return new Date().toISOString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function readJsonIfExists(targetPath) {
  if (!(await fileExists(targetPath))) {
    return undefined;
  }
  const text = await fs.readFile(targetPath, "utf8");
  return JSON.parse(text);
}

async function writeJson(targetPath, value) {
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, JSON.stringify(value, null, 2), "utf8");
}

function getRootWorkspaceFolder() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri.fsPath;
}

async function copyRecursive(srcPath, dstPath, overwrite) {
  const stat = await fs.stat(srcPath);
  if (stat.isDirectory()) {
    await ensureDir(dstPath);
    const entries = await fs.readdir(srcPath, { withFileTypes: true });
    for (const entry of entries) {
      const srcChild = path.join(srcPath, entry.name);
      const dstChild = path.join(dstPath, entry.name);
      await copyRecursive(srcChild, dstChild, overwrite);
    }
    return;
  }

  await ensureDir(path.dirname(dstPath));
  if (!overwrite && (await fileExists(dstPath))) {
    return;
  }
  await fs.copyFile(srcPath, dstPath);
}

async function getBundles(context) {
  return context.globalState.get(STORAGE_KEY, []);
}

async function saveBundles(context, bundles) {
  await context.globalState.update(STORAGE_KEY, bundles);
}

function makeBundleId() {
  return `bundle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function collectResourceEntries() {
  const selectedEntries = [];
  const seen = new Set();

  while (true) {
    const mode = await vscode.window.showQuickPick(
      [
        { label: "ファイルを追加", value: "files" },
        { label: "フォルダを追加", value: "folders" },
        { label: "選択を終了", value: "done" }
      ],
      { placeHolder: "コピー対象リソース（ワークスペースへコピーするファイル/フォルダ）を選択してください" }
    );

    if (!mode || mode.value === "done") {
      break;
    }

    const picked =
      (await vscode.window.showOpenDialog({
        canSelectMany: true,
        canSelectFiles: mode.value === "files",
        canSelectFolders: mode.value === "folders",
        openLabel: mode.value === "files" ? "コピー対象ファイルを選択" : "コピー対象フォルダを選択"
      })) || [];

    for (const uri of picked) {
      if (!seen.has(uri.fsPath)) {
        seen.add(uri.fsPath);
        selectedEntries.push(uri);
      }
    }
  }

  return selectedEntries;
}

function countSettings(bundle) {
  if (bundle.settingsData && typeof bundle.settingsData === "object") {
    return Object.keys(bundle.settingsData).length;
  }
  if (bundle.settingsRelativePath) {
    return -1;
  }
  return 0;
}

function formatSettingsLabel(bundle) {
  const count = countSettings(bundle);
  if (count === -1) {
    return "旧形式";
  }
  return `${count}件`;
}

function formatAddFolderLabel(bundle) {
  return bundle.workspaceFolderToAdd ? "有" : "無";
}

async function addFolderToWorkspace(targetFolderPath) {
  if (!targetFolderPath) {
    return false;
  }

  if (!(await fileExists(targetFolderPath))) {
    vscode.window.showWarningMessage(`追加対象フォルダが見つかりません: ${targetFolderPath}`);
    return false;
  }

  const folders = vscode.workspace.workspaceFolders || [];
  if (folders.some((f) => f.uri.fsPath === targetFolderPath)) {
    return false;
  }

  const index = folders.length;
  return vscode.workspace.updateWorkspaceFolders(index, null, {
    uri: vscode.Uri.file(targetFolderPath),
    name: path.basename(targetFolderPath)
  });
}

async function registerBundle(context) {
  const root = getRootWorkspaceFolder();
  if (!root) {
    vscode.window.showErrorMessage("ワークスペースを開いてから実行してください。");
    return false;
  }

  const bundleName = await vscode.window.showInputBox({
    prompt: "登録するバンドル名を入力してください",
    placeHolder: "例: Backend Onboarding"
  });

  if (!bundleName) {
    return false;
  }

  const includeSettings =
    (await vscode.window.showQuickPick(["はい", "いいえ"], {
      placeHolder: "現在のワークスペース設定 (.vscode/settings.json) を登録しますか？"
    })) === "はい";

  let settingsData;
  if (includeSettings) {
    const settingsPath = path.join(root, ".vscode", "settings.json");
    if (await fileExists(settingsPath)) {
      const currentSettings = await readJsonIfExists(settingsPath);
      if (currentSettings && typeof currentSettings === "object") {
        const keys = Object.keys(currentSettings);
        if (keys.length > 0) {
          const selectionMode = await vscode.window.showQuickPick(
            [
              { label: "すべての設定キーを登録する", value: "all" },
              { label: "選択した設定キーだけ登録する", value: "pick" }
            ],
            { placeHolder: "設定の登録方法を選択してください" }
          );

          if (!selectionMode) {
            return false;
          }

          if (selectionMode.value === "all") {
            settingsData = currentSettings;
          } else {
            const selected = await vscode.window.showQuickPick(
              keys.map((key) => ({ label: key })),
              {
                canPickMany: true,
                placeHolder: "適用したい設定キーを選択してください"
              }
            );

            if (!selected || selected.length === 0) {
              vscode.window.showWarningMessage("設定キーが選択されなかったため、設定は登録しません。");
            } else {
              settingsData = {};
              for (const item of selected) {
                settingsData[item.label] = currentSettings[item.label];
              }
            }
          }
        }
      }
    } else {
      vscode.window.showWarningMessage(".vscode/settings.json が見つからないため、設定は登録しません。");
    }
  }

  const selectedEntries = await collectResourceEntries();

  const includeWorkspaceFolderToAdd =
    (await vscode.window.showQuickPick(["はい", "いいえ"], {
      placeHolder:
        "コピー対象とは別に、適用時にワークスペースへ追加するフォルダを指定しますか？"
    })) === "はい";

  let workspaceFolderToAdd;
  if (includeWorkspaceFolderToAdd) {
    const pickedFolder = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: "ワークスペースへ追加する専用フォルダを選択"
    });
    workspaceFolderToAdd = pickedFolder?.[0]?.fsPath;
  }

  const includeWorkspace =
    (await vscode.window.showQuickPick(["はい", "いいえ"], {
      placeHolder: "保存済みワークスペース (.code-workspace) も登録しますか？"
    })) === "はい";

  let workspaceFile;
  if (includeWorkspace) {
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: true,
      canSelectFolders: false,
      filters: { Workspace: ["code-workspace"] },
      openLabel: "登録する .code-workspace を選択"
    });
    workspaceFile = picked?.[0]?.fsPath;
  }

  const bundles = await getBundles(context);
  const id = makeBundleId();
  const bundleDir = path.join(context.globalStorageUri.fsPath, "bundles", id);
  const resourcesDir = path.join(bundleDir, "resources");

  await ensureDir(resourcesDir);

  const resources = [];
  for (const uri of selectedEntries) {
    const sourcePath = uri.fsPath;
    const baseName = path.basename(sourcePath);
    const destinationRelative = path.join("resources", baseName);
    const destinationPath = path.join(bundleDir, destinationRelative);
    await copyRecursive(sourcePath, destinationPath, true);
    resources.push({
      name: baseName,
      relativePath: destinationRelative,
      sourcePath
    });
  }

  let workspaceRelative;
  if (workspaceFile) {
    workspaceRelative = "workspace.code-workspace";
    await copyRecursive(workspaceFile, path.join(bundleDir, workspaceRelative), true);
  }

  bundles.push({
    id,
    name: bundleName,
    createdAt: nowIso(),
    settingsData,
    resources,
    workspaceFolderToAdd,
    workspaceRelativePath: workspaceRelative
  });

  await saveBundles(context, bundles);
  vscode.window.showInformationMessage(
    `バンドル「${bundleName}」を登録しました。設定:${settingsData ? Object.keys(settingsData).length : 0}件 / リソース:${resources.length}件 / 追加フォルダ:${workspaceFolderToAdd ? "有" : "無"} / ワークスペース:${workspaceRelative ? "有" : "無"}`
  );
  return true;
}

async function pickBundleByIdOrPrompt(context, bundleId, prompt) {
  const bundles = await getBundles(context);
  if (bundles.length === 0) {
    vscode.window.showInformationMessage("登録済みのバンドルはありません。");
    return undefined;
  }

  if (bundleId) {
    return bundles.find((b) => b.id === bundleId);
  }

  const picked = await vscode.window.showQuickPick(
    bundles.map((b) => ({
      label: b.name,
      description: `settings:${formatSettingsLabel(b)} / resources:${b.resources?.length || 0} / addFolder:${formatAddFolderLabel(b)} / workspace:${b.workspaceRelativePath ? "有" : "無"}`,
      detail: `作成日時: ${b.createdAt}`,
      bundle: b
    })),
    { placeHolder: prompt }
  );

  return picked?.bundle;
}

async function applyBundle(context, bundleId) {
  const root = getRootWorkspaceFolder();
  if (!root) {
    vscode.window.showErrorMessage("ワークスペースを開いてから実行してください。");
    return false;
  }

  const bundle = await pickBundleByIdOrPrompt(
    context,
    bundleId,
    "適用するバンドルを選択してください"
  );

  if (!bundle) {
    return false;
  }

  const bundleDir = path.join(context.globalStorageUri.fsPath, "bundles", bundle.id);

  let incomingSettings;
  if (bundle.settingsData && typeof bundle.settingsData === "object") {
    incomingSettings = bundle.settingsData;
  } else if (bundle.settingsRelativePath) {
    const sourceSettingsPath = path.join(bundleDir, bundle.settingsRelativePath);
    if (await fileExists(sourceSettingsPath)) {
      incomingSettings = await readJsonIfExists(sourceSettingsPath);
    }
  }

  if (incomingSettings && typeof incomingSettings === "object") {
    const currentSettingsPath = path.join(root, ".vscode", "settings.json");
    const current = (await readJsonIfExists(currentSettingsPath)) || {};
    const merged = { ...current, ...incomingSettings };
    await writeJson(currentSettingsPath, merged);
  }

  let overwrite = false;
  if (bundle.resources?.length) {
    const overwriteChoice = await vscode.window.showQuickPick(
      [
        { label: "上書きする", value: true },
        { label: "既存ファイルを維持する", value: false }
      ],
      { placeHolder: "既存ファイルがある場合の扱いを選択してください" }
    );

    if (!overwriteChoice) {
      return false;
    }

    overwrite = overwriteChoice.value;

    for (const resource of bundle.resources) {
      const srcPath = path.join(bundleDir, resource.relativePath);
      const dstPath = path.join(root, resource.name);
      if (await fileExists(srcPath)) {
        await copyRecursive(srcPath, dstPath, overwrite);
      }
    }
  }

  if (bundle.workspaceFolderToAdd) {
    await addFolderToWorkspace(bundle.workspaceFolderToAdd);
  }

  if (bundle.workspaceRelativePath) {
    const sourceWorkspacePath = path.join(bundleDir, bundle.workspaceRelativePath);
    if (await fileExists(sourceWorkspacePath)) {
      const openChoice = await vscode.window.showQuickPick(["開く", "開かない"], {
        placeHolder: "保存された .code-workspace を開きますか？（新しいウィンドウ）"
      });

      if (openChoice === "開く") {
        await vscode.commands.executeCommand(
          "vscode.openFolder",
          vscode.Uri.file(sourceWorkspacePath),
          true
        );
      }
    }
  }

  vscode.window.showInformationMessage(`バンドル「${bundle.name}」を適用しました。`);
  return true;
}

async function deleteBundle(context, bundleId) {
  const bundle = await pickBundleByIdOrPrompt(
    context,
    bundleId,
    "削除するバンドルを選択してください"
  );

  if (!bundle) {
    return false;
  }

  const confirm = await vscode.window.showQuickPick(["削除する", "キャンセル"], {
    placeHolder: `"${bundle.name}" を削除しますか？`
  });

  if (confirm !== "削除する") {
    return false;
  }

  const bundles = await getBundles(context);
  const remained = bundles.filter((b) => b.id !== bundle.id);
  await saveBundles(context, remained);

  const bundleDir = path.join(context.globalStorageUri.fsPath, "bundles", bundle.id);
  await fs.rm(bundleDir, { recursive: true, force: true });

  vscode.window.showInformationMessage(`バンドル「${bundle.name}」を削除しました。`);
  return true;
}

async function listBundles(context) {
  const bundles = await getBundles(context);
  if (bundles.length === 0) {
    vscode.window.showInformationMessage("登録済みのバンドルはありません。");
    return;
  }

  const lines = bundles.map(
    (b, idx) =>
      `${idx + 1}. ${b.name} | settings:${formatSettingsLabel(b)} | resources:${b.resources?.length || 0} | addFolder:${formatAddFolderLabel(b)} | workspace:${b.workspaceRelativePath ? "有" : "無"} | created:${b.createdAt}`
  );

  const doc = await vscode.workspace.openTextDocument({
    content: lines.join("\n"),
    language: "text"
  });
  await vscode.window.showTextDocument(doc, { preview: false });
}

class BundleSidebarViewProvider {
  constructor(context) {
    this.context = context;
    this.view = undefined;
  }

  async resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (!message || typeof message !== "object") {
        return;
      }

      if (message.type === "register") {
        if (await registerBundle(this.context)) {
          await this.refresh();
        }
        return;
      }

      if (message.type === "apply") {
        await applyBundle(this.context, message.bundleId);
        await this.refresh();
        return;
      }

      if (message.type === "delete") {
        if (await deleteBundle(this.context, message.bundleId)) {
          await this.refresh();
        }
        return;
      }

      if (message.type === "list") {
        await listBundles(this.context);
        return;
      }

      if (message.type === "refresh") {
        await this.refresh();
      }
    });

    await this.refresh();
  }

  async refresh() {
    if (!this.view) {
      return;
    }

    const bundles = await getBundles(this.context);
    this.view.webview.html = this.getHtml(this.view.webview, bundles);
  }

  getHtml(webview, bundles) {
    const rows = bundles
      .map((bundle) => {
        const label = escapeHtml(bundle.name);
        const meta = `settings:${formatSettingsLabel(bundle)} / resources:${bundle.resources?.length || 0} / addFolder:${formatAddFolderLabel(bundle)} / workspace:${bundle.workspaceRelativePath ? "有" : "無"}`;
        const metaEscaped = escapeHtml(meta);
        const createdEscaped = escapeHtml(bundle.createdAt || "-");
        const idEscaped = escapeHtml(bundle.id);

        return `
          <div class="bundle-row">
            <div class="bundle-title">${label}</div>
            <div class="bundle-meta">${metaEscaped}</div>
            <div class="bundle-meta">${createdEscaped}</div>
            <div class="bundle-actions">
              <button data-action="apply" data-id="${idEscaped}">適用</button>
              <button data-action="delete" data-id="${idEscaped}" class="danger">削除</button>
            </div>
          </div>
        `;
      })
      .join("\n");

    const bundleHtml = rows || '<div class="empty">登録済みのバンドルはありません。</div>';

    return `
<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 8px;
    }
    .top-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 12px;
    }
    button {
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-radius: 4px;
      padding: 6px 8px;
      cursor: pointer;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .danger {
      background: var(--vscode-inputValidation-errorBackground, var(--vscode-button-background));
      color: var(--vscode-inputValidation-errorForeground, var(--vscode-button-foreground));
    }
    .bundle-row {
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 8px;
      background: var(--vscode-editorWidget-background);
    }
    .bundle-title {
      font-weight: 600;
      margin-bottom: 4px;
      word-break: break-word;
    }
    .bundle-meta {
      opacity: 0.85;
      font-size: 11px;
      margin-bottom: 2px;
      word-break: break-word;
    }
    .bundle-actions {
      display: flex;
      gap: 6px;
      margin-top: 6px;
    }
    .empty {
      opacity: 0.8;
      padding: 8px 0;
    }
  </style>
</head>
<body>
  <div class="top-actions">
    <button id="register">登録</button>
    <button id="list">一覧テキスト</button>
    <button id="refresh">更新</button>
  </div>
  <div>${bundleHtml}</div>

  <script>
    const vscode = acquireVsCodeApi();

    document.getElementById("register")?.addEventListener("click", () => {
      vscode.postMessage({ type: "register" });
    });

    document.getElementById("list")?.addEventListener("click", () => {
      vscode.postMessage({ type: "list" });
    });

    document.getElementById("refresh")?.addEventListener("click", () => {
      vscode.postMessage({ type: "refresh" });
    });

    document.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const type = button.getAttribute("data-action");
        const bundleId = button.getAttribute("data-id");
        vscode.postMessage({ type, bundleId });
      });
    });
  </script>
</body>
</html>
    `;
  }
}

function activate(context) {
  const sidebarProvider = new BundleSidebarViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("addConfigBundles.sidebarView", sidebarProvider),
    vscode.commands.registerCommand("addConfigBundles.registerBundle", async () => {
      if (await registerBundle(context)) {
        await sidebarProvider.refresh();
      }
    }),
    vscode.commands.registerCommand("addConfigBundles.applyBundle", async () => {
      await applyBundle(context);
      await sidebarProvider.refresh();
    }),
    vscode.commands.registerCommand("addConfigBundles.deleteBundle", async () => {
      if (await deleteBundle(context)) {
        await sidebarProvider.refresh();
      }
    }),
    vscode.commands.registerCommand("addConfigBundles.listBundles", () => listBundles(context)),
    vscode.commands.registerCommand("addConfigBundles.refreshSidebar", () => sidebarProvider.refresh())
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
