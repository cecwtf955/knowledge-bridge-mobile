# Knowledge Bridge Mobile / 知识桥手机扩展

在 Obsidian 中读取 Zotero 云端 PDF 批注，新建或关联笔记，并在 Zotero 父文献下添加返回 Obsidian 的链接。电脑关机时也可以在手机独立使用，需要联网和 Zotero 数据同步。

这是桌面知识桥的独立扩展，插件 ID 为 `knowledge-bridge-mobile`，可与原桌面版并存。新增流程已实现，0.2.0 仍为待 iPhone 实机验收的预览版；32 项模拟自动化测试通过不代表真机验收。

## 通过 BRAT 安装

1. 在 Obsidian 社区插件市场安装并启用 BRAT。
2. 打开 BRAT 设置，选择 **Add Beta plugin**。
3. 填入本仓库地址，选择版本 `0.2.0`（或 Latest），添加并启用。
4. 在“知识桥手机扩展”设置中检查“同步仓库子目录”。若 Git 克隆在 `notes` 子目录，填写 `notes`；直接打开仓库时留空。
5. 点击“连接 Zotero”，填写数字用户 ID 和 API 密钥。

Zotero 密钥设置：[Settings → Feeds/API](https://www.zotero.org/settings/keys)。需启用个人库 library access、notes access 和 write access，以读取批注、检查重复笔记和添加返回链接。不需要群组权限。密钥只驻留本次运行内存，不保存到插件配置或笔记，重载插件后需要重新输入。

## 0.2.0 的创建流程

- 同一窗口使用“新建笔记 / 新建文件夹 / 关联已有笔记”三个按钮切换，不再弹出全库长路径选择器。
- 逐层点击文件夹进入目标位置，使用“上一级”返回；新建文件夹内用“默认.md”承载关联。
- Obsidian 编辑模式选中文字后，点击编辑器上方“选区 → 新建 / 关联”，或使用编辑器选区菜单、同名命令；可添加到手机工具栏。
- 阅读模式仅对能在原 Markdown 中唯一匹配的选区提供创建；含排版或重复文本时需切换编辑模式。
- 创建 Obsidian 选区关联时保留一次该操作的原文备份，再把选区改为可点击的高亮链接；新目标带“返回 Obsidian 原句”。备份位于设备插件目录的 source-backups。
- 电脑与手机在此扩展中使用同一创建界面。旧桌面知识桥的 Word/Excel 功能与旧链接继续由旧插件处理，尚未迁移到这套新界面。
- iOS Zotero 原生选中文字菜单无法加入本插件按钮；Zotero 来源仍需高亮、同步后进入 Obsidian 选择批注，不能宣称与电脑 Zotero 的入口完全一致。
- 32 项数据流程测试及手机/桌面尺寸的模拟 DOM 点击测试已通过；尚未完成新版本的真实 iPhone 验收。

## 使用

1. 手机 Zotero 中完成 PDF 批注并同步。
2. 在 Obsidian 先完成笔记库同步，再运行命令 **从 Zotero 批注新建 / 关联笔记**。
3. 选择最近的 PDF 批注，新建笔记或选择已有笔记。
4. 可勾选“在 Zotero 添加返回链接”。该操作会在父文献下新增一条笔记，不修改原文献或 PDF。
5. Obsidian 中点击 PDF 回链；Zotero 同步后，在父文献下的知识桥笔记点击“打开 Obsidian 关联笔记”。
6. 若使用 Git，编辑后执行 `Git: Commit-and-sync`，另一设备执行 `Git: Pull`。

主返回链接按“Zotero 用户 ID + 批注 key”查找同步笔记，不依赖两端库名、路径或插件目录里的关联表。两端都需安装本扩展，并打开包含相关笔记的库。备用链接保留创建时的库名和路径，重命名后该备用链接可能失效。

## 已知边界

- 只支持个人库最近 100 条批注中的 PDF 批注，不支持群组库或 EPUB 定位。
- 图片、手写批注生成 PDF 回链和提示，不复制图像。
- 新建入口在 Obsidian，不会向 iOS Zotero 阅读器加入桌面插件按钮。
- 无离线批注缓存；连接云端需要网络和先完成 Zotero 同步。
- 已有标准 PDF 回链的笔记可以复用；创建关联时会添加一个包含用户 ID、批注 key 的 HTML 注释标识，用于跨端定位。
- 网络失败保留本地笔记，重试会先查重。不同设备同时创建同一关联时仍可能产生重复。
- 不自动同步 Obsidian 文件，不读写桌面旧插件的 `links.json`。
- 旧桌面插件按标准回链恢复映射的流程、iOS 跳转和真实云端读写仍需验收。
- API 请求只发送到 `https://api.zotero.org`，无分析统计或第三方后端。

## 开发

Node.js 20 或更高版本：

```sh
npm ci
npm test
npm run build
```

发布附件为 `main.js`、`manifest.json` 和 `styles.css`。仓库根目录 manifest 版本需与 GitHub release tag 一致。

## 接口依据

- [Zotero Web API](https://www.zotero.org/support/dev/web_api/v3/basics)
- [Zotero 写入接口](https://www.zotero.org/support/dev/web_api/v3/write_requests)
- [Zotero iOS URL 处理](https://github.com/zotero/zotero-ios/blob/master/Zotero/Controllers/CustomURLController.swift)
- [Obsidian API](https://github.com/obsidianmd/obsidian-api)

本仓库只包含插件源码、测试和构建文件，不包含笔记、文献、API 密钥或桌面软件配置。
