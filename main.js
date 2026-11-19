var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// src/core.js
var require_core = __commonJS({
  "src/core.js"(exports2, module2) {
    "use strict";
    var key = (s) => /^[23456789ABCDEFGHIJKLMNPQRSTUVWXYZ]{8}$/.test(s || "");
    var html = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    function annotation2(data) {
      if (data.itemType !== "annotation" || !key(data.key) || !key(data.parentItem)) throw Error("\u65E0\u6548\u6279\u6CE8");
      let position;
      try {
        position = JSON.parse(data.annotationPosition);
      } catch {
        throw Error("\u6279\u6CE8\u7F3A\u5C11 PDF \u5B9A\u4F4D\u4FE1\u606F");
      }
      if (!Number.isInteger(position.pageIndex) || position.pageIndex < 0) throw Error("\u4EC5\u652F\u6301 PDF \u6279\u6CE8");
      return {
        key: data.key,
        attachment: data.parentItem,
        page: position.pageIndex + 1,
        quote: data.annotationText || data.annotationComment || "\uFF08\u56FE\u7247\u6216\u624B\u5199\u6279\u6CE8\uFF0C\u8BF7\u8FD4\u56DE PDF \u67E5\u770B\uFF09",
        pdf: `zotero://open-pdf/library/items/${data.parentItem}?page=${position.pageIndex + 1}&annotation=${data.key}`
      };
    }
    function marker2(user, a) {
      if (!/^\d+$/.test(user) || !key(a.key)) throw Error("\u65E0\u6548\u5173\u8054\u6807\u8BC6");
      return `<!-- knowledge-bridge-mobile:${user}:${a.key} -->`;
    }
    function block2(user, a) {
      return `${marker2(user, a)}
[\u8FD4\u56DE Zotero PDF \u539F\u53E5](${a.pdf})

${a.quote.replace(/\r/g, "").split("\n").map((s) => "> " + s).join("\n")}

`;
    }
    var Cloud2 = class {
      constructor(request, user, token) {
        if (!/^\d+$/.test(user)) throw Error("\u8BF7\u586B\u5199 Zotero \u6570\u5B57\u7528\u6237 ID");
        if (!token) throw Error("\u8BF7\u5148\u8FDE\u63A5 Zotero");
        this.request = request;
        this.user = user;
        this.token = token;
        this.until = 0;
      }
      async call(path, method = "GET", body, extra = {}) {
        if (Date.now() < this.until) throw Error("Zotero \u8981\u6C42\u7A0D\u5019\uFF0C\u8BF7\u8FC7\u4E00\u5206\u949F\u91CD\u8BD5");
        let r;
        try {
          r = await this.request({
            url: "https://api.zotero.org" + path,
            method,
            throw: false,
            headers: { "Zotero-API-Version": "3", "Zotero-API-Key": this.token, ...body ? { "Content-Type": "application/json" } : {}, ...extra },
            ...body ? { body: JSON.stringify(body) } : {}
          });
        } catch {
          throw Error("\u65E0\u6CD5\u8FDE\u63A5 Zotero\uFF1B\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002\u5DF2\u6709\u672C\u5730\u7B14\u8BB0\u4F1A\u4FDD\u7559\u3002");
        }
        const h = Object.fromEntries(Object.entries(r.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
        const delay = Number(h.backoff || h["retry-after"] || 0);
        if (delay > 0) this.until = Date.now() + delay * 1e3;
        if (r.status === 429) {
          this.until = Math.max(this.until, Date.now() + 6e4);
          throw Error("Zotero \u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
        }
        if (r.status === 401 || r.status === 403) throw Error("Zotero \u5BC6\u94A5\u65E0\u6548\u6216\u6743\u9650\u4E0D\u8DB3\uFF1B\u5EFA\u7ACB\u8FD4\u56DE\u94FE\u63A5\u9700\u8981\u4E2A\u4EBA\u5E93\u5199\u5165\u6743\u9650");
        if (r.status < 200 || r.status >= 300) throw Error("Zotero \u8BF7\u6C42\u672A\u5B8C\u6210\uFF08HTTP " + r.status + "\uFF09\uFF0C\u53EF\u7A0D\u540E\u91CD\u8BD5");
        return r.json;
      }
      async list(suffix) {
        const out = [];
        for (let start = 0; ; start += 100) {
          const rows = await this.call(`/users/${this.user}/${suffix}${suffix.includes("?") ? "&" : "?"}limit=100&start=${start}`);
          if (!Array.isArray(rows)) throw Error("Zotero \u8FD4\u56DE\u683C\u5F0F\u5F02\u5E38");
          out.push(...rows);
          if (rows.length < 100) return out;
        }
      }
      async item(k) {
        if (!key(k)) throw Error("\u65E0\u6548\u6761\u76EE\u6807\u8BC6");
        return (await this.call(`/users/${this.user}/items/${k}`)).data;
      }
      async recent() {
        return (await this.call(`/users/${this.user}/items?itemType=annotation&sort=dateModified&direction=desc&limit=100`)).map((r) => r.data);
      }
      async backlink(a, vault, file, writeToken) {
        const attachment = await this.item(a.attachment);
        const parent = attachment.parentItem;
        if (!key(parent)) throw Error("\u8BE5 PDF \u6CA1\u6709\u7236\u6587\u732E\u6761\u76EE\uFF1B\u672C\u5730\u5173\u8054\u5DF2\u4FDD\u7559\uFF0C\u8BF7\u5148\u5728 Zotero \u7ED9 PDF \u5EFA\u7ACB\u7236\u6761\u76EE");
        const uri = `obsidian://knowledge-bridge-mobile?action=open&user=${this.user}&annotation=${a.key}`;
        const fallback = `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(file)}`;
        const id = `KBM:${this.user}:${a.key}`;
        const notes = await this.list(`items/${parent}/children`);
        const existing = notes.find((n) => n.data.itemType === "note" && (n.data.tags || []).some((t) => t.tag === id) && n.data.note.includes(html(uri)));
        if (existing) return existing.key;
        const template = await this.call("/items/new?itemType=note");
        const payload = { ...template, parentItem: parent, note: `<p>\u77E5\u8BC6\u6865 \xB7 ${html(file)}</p><p><a href="${html(uri)}">\u6253\u5F00 Obsidian \u5173\u8054\u7B14\u8BB0</a></p><p><a href="${html(fallback)}">\u6309\u521B\u5EFA\u65F6\u7684\u8DEF\u5F84\u6253\u5F00\uFF08\u5907\u7528\uFF09</a></p><blockquote>${html(a.quote)}</blockquote><p><a href="${html(a.pdf)}">\u8FD4\u56DE PDF \u6279\u6CE8</a></p>`, tags: [{ tag: id }] };
        const result = await this.call(`/users/${this.user}/items`, "POST", [payload], { "Zotero-Write-Token": writeToken });
        if (result.failed?.["0"]) throw Error("Zotero \u8FD4\u56DE\u94FE\u63A5\u5199\u5165\u5931\u8D25\uFF1A" + result.failed["0"].message);
        const saved = result.successful?.["0"]?.key || result.unchanged?.["0"];
        if (!saved) throw Error("Zotero \u672A\u786E\u8BA4\u5199\u5165\uFF1B\u8BF7\u91CD\u8BD5\uFF0C\u63D2\u4EF6\u4F1A\u5148\u68C0\u67E5\u662F\u5426\u5DF2\u7ECF\u5B58\u5728");
        return saved;
      }
    };
    module2.exports = { Cloud: Cloud2, annotation: annotation2, marker: marker2, block: block2, html };
  }
});

// src/main.js
var { Plugin, PluginSettingTab, Modal, Setting, FuzzySuggestModal, Notice, TFile, requestUrl, Platform } = require("obsidian");
var { Cloud, annotation, marker, block } = require_core();
var Pick = class extends FuzzySuggestModal {
  constructor(app, rows, label, choose) {
    super(app);
    this.rows = rows;
    this.label = label;
    this.choose = choose;
  }
  getItems() {
    return this.rows;
  }
  getItemText(x) {
    return this.label(x);
  }
  onChooseItem(x) {
    Promise.resolve().then(() => this.choose(x)).catch((e) => new Notice(e.message, 12e3));
  }
};
var Connect = class extends Modal {
  constructor(p, done) {
    super(p.app);
    this.p = p;
    this.done = done;
  }
  onOpen() {
    this.titleEl.setText("\u8FDE\u63A5 Zotero");
    this.contentEl.createEl("p", { text: "\u5728 Zotero \u7F51\u7AD9\u7684 Settings \u2192 Feeds/API \u521B\u5EFA\u4E2A\u4EBA\u5E93\u5BC6\u94A5\u3002\u8BFB\u53D6\u6279\u6CE8\u9700\u8BFB\u53D6\u6743\u9650\uFF1B\u6DFB\u52A0\u8FD4\u56DE\u7B14\u8BB0\u7684\u94FE\u63A5\u9700\u5199\u5165\u6743\u9650\u3002\u5BC6\u94A5\u53EA\u4FDD\u5B58\u5728\u672C\u6B21\u8FD0\u884C\u5185\u5B58\u4E2D\uFF0C\u5173\u95ED\u63D2\u4EF6\u540E\u9700\u91CD\u65B0\u8F93\u5165\u3002" });
    this.contentEl.createEl("a", { text: "\u6253\u5F00 Zotero \u5BC6\u94A5\u8BBE\u7F6E", href: "https://www.zotero.org/settings/keys" });
    let user = this.p.settings.user, token = "";
    new Setting(this.contentEl).setName("\u6570\u5B57\u7528\u6237 ID").addText((t) => t.setValue(user).onChange((v) => user = v.trim()));
    new Setting(this.contentEl).setName("API \u5BC6\u94A5").addText((t) => {
      t.inputEl.type = "password";
      t.onChange((v) => token = v.trim());
    });
    const status = this.contentEl.createEl("p");
    new Setting(this.contentEl).addButton((b) => b.setButtonText("\u8FDE\u63A5").setCta().onClick(async () => {
      b.setDisabled(true);
      try {
        const cloud = new Cloud(requestUrl, user, token);
        await cloud.call(`/users/${user}/items?limit=1`);
        this.p.cloud = cloud;
        this.p.settings.user = user;
        await this.p.saveData(this.p.settings);
        this.close();
        if (this.done) await this.done();
        else new Notice("\u5DF2\u8FDE\u63A5 Zotero");
      } catch (e) {
        status.setText(e.message);
      } finally {
        b.setDisabled(false);
      }
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var Settings = class extends PluginSettingTab {
  constructor(p) {
    super(p.app, p);
    this.p = p;
  }
  display() {
    this.containerEl.empty();
    this.containerEl.createEl("h2", { text: "\u77E5\u8BC6\u6865 \xB7 \u624B\u673A\u6269\u5C55" });
    this.containerEl.createEl("p", { text: "\u4F7F\u7528 Zotero \u4E91\u7AEF\u4E2A\u4EBA\u5E93\uFF0C\u4E0D\u9700\u8981\u7535\u8111\u5F00\u673A\u3002\u8BF7\u5148\u5728\u624B\u673A Zotero \u5B8C\u6210\u6279\u6CE8\u540C\u6B65\u3002" });
    new Setting(this.containerEl).setName("Zotero \u8FDE\u63A5").addButton((b) => b.setButtonText("\u8FDE\u63A5 / \u5207\u6362\u8D26\u53F7").onClick(() => new Connect(this.p).open()));
    new Setting(this.containerEl).setName("\u540C\u6B65\u4ED3\u5E93\u5B50\u76EE\u5F55").setDesc("\u82E5 Git \u4ED3\u5E93\u653E\u5728 notes \u5B50\u6587\u4EF6\u5939\u4E2D\uFF0C\u8BF7\u586B\u5199 notes\uFF1B\u76F4\u63A5\u6253\u5F00 Git \u4ED3\u5E93\u65F6\u7559\u7A7A\u3002").addText((t) => t.setValue(this.p.settings.root).setPlaceholder("notes \u6216\u7559\u7A7A").onChange(async (v) => {
      const root = v.trim();
      if (root && (!/^[^\\:*?"<>|]+$/.test(root) || root.split("/").some((s) => !s || s === "." || s === ".."))) return;
      this.p.settings.root = root;
      await this.p.saveData(this.p.settings);
    }));
    new Setting(this.containerEl).setName("\u65AD\u5F00\u8FDE\u63A5").addButton((b) => b.setButtonText("\u6E05\u9664\u5185\u5B58\u4E2D\u7684\u5BC6\u94A5").onClick(() => {
      this.p.cloud = null;
      new Notice("\u5DF2\u65AD\u5F00");
    }));
  }
};
var Associate = class extends Modal {
  constructor(p, a) {
    super(p.app);
    this.p = p;
    this.a = a;
    this.title = "";
    this.target = null;
    this.reverse = true;
  }
  onOpen() {
    this.titleEl.setText("\u5173\u8054 Zotero \u6279\u6CE8");
    this.contentEl.createEl("blockquote", { text: this.a.quote });
    this.contentEl.createEl("p", { text: "PDF \u7B2C " + this.a.page + " \u9875\uFF1B\u6279\u6CE8 " + this.a.key });
    new Setting(this.contentEl).setName("\u65B0\u7B14\u8BB0\u540D\u79F0").setDesc("\u4FDD\u5B58\u5728 " + (this.p.settings.root ? this.p.settings.root + "/" : "") + "\u77E5\u8BC6\u6865\u624B\u673A\uFF0C\u4E5F\u53EF\u9009\u62E9\u5DF2\u6709\u7B14\u8BB0\u3002").addText((t) => t.setPlaceholder("\u7559\u7A7A\u4F7F\u7528\u6279\u6CE8\u7F16\u53F7").onChange((v) => this.title = v));
    const selected = this.contentEl.createEl("p", { text: "\u76EE\u6807\uFF1A\u65B0\u5EFA\u7B14\u8BB0" });
    new Setting(this.contentEl).setName("\u5173\u8054\u5DF2\u6709\u7B14\u8BB0").addButton((b) => b.setButtonText("\u9009\u62E9").onClick(() => new Pick(this.app, this.p.syncFiles(), (f) => f.path, (f) => {
      this.target = f;
      selected.setText("\u76EE\u6807\uFF1A" + f.path);
    }).open())).addButton((b) => b.setButtonText("\u6539\u4E3A\u65B0\u5EFA").onClick(() => {
      this.target = null;
      selected.setText("\u76EE\u6807\uFF1A\u65B0\u5EFA\u7B14\u8BB0");
    }));
    new Setting(this.contentEl).setName("\u5728 Zotero \u6DFB\u52A0\u8FD4\u56DE\u94FE\u63A5").setDesc("\u5728\u7236\u6587\u732E\u4E0B\u65B0\u589E\u4E00\u6761\u77E5\u8BC6\u6865\u7B14\u8BB0\uFF0C\u4F9B\u624B\u673A Zotero \u8DF3\u56DE Obsidian\u3002").addToggle((t) => t.setValue(true).onChange((v) => this.reverse = v));
    const status = this.contentEl.createEl("p");
    new Setting(this.contentEl).addButton((b) => b.setButtonText("\u5EFA\u7ACB\u5173\u8054").setCta().onClick(async () => {
      b.setDisabled(true);
      try {
        if (!this.p.cloud) throw Error("\u8BF7\u5148\u91CD\u65B0\u8FDE\u63A5 Zotero");
        const result = await this.p.associate(this.a, this.title, this.target, this.reverse);
        status.setText(result.message);
        await this.app.workspace.getLeaf(false).openFile(result.file);
        if (result.ok) {
          new Notice(result.message);
          this.close();
        }
      } catch (e) {
        status.setText(e.message);
      } finally {
        b.setDisabled(false);
      }
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
module.exports = class MobileBridge extends Plugin {
  async onload() {
    const saved = await this.loadData();
    const autoRoot = Platform.isMobileApp && await this.app.vault.adapter.exists("notes/.git") ? "notes" : "";
    this.settings = { user: String(saved?.user || ""), root: saved?.root ?? autoRoot };
    this.cloud = null;
    this.queue = Promise.resolve();
    this.writeTokens = /* @__PURE__ */ new Map();
    this.addSettingTab(new Settings(this));
    this.addCommand({ id: "connect", name: "\u8FDE\u63A5 Zotero \u4E91\u7AEF", callback: () => new Connect(this).open() });
    this.addCommand({ id: "link-annotation", name: "\u4ECE Zotero \u6279\u6CE8\u65B0\u5EFA / \u5173\u8054\u7B14\u8BB0", callback: () => this.browse() });
    this.addRibbonIcon("link", "\u77E5\u8BC6\u6865\uFF1A\u5173\u8054 Zotero \u6279\u6CE8", () => this.browse());
    this.registerObsidianProtocolHandler("knowledge-bridge-mobile", (params) => {
      if (params.vault && params.vault !== this.app.vault.getName()) {
        new Notice("\u8BF7\u5148\u6253\u5F00\u7B14\u8BB0\u5E93\uFF1A" + params.vault);
        return;
      }
      if (params.action === "open") {
        this.openLinked(params.user, params.annotation).catch((e) => new Notice(e.message, 12e3));
        return;
      }
      if (params.annotation) this.openAnnotation(params.annotation);
      else this.browse();
    });
  }
  onunload() {
    this.cloud = null;
    this.writeTokens.clear();
  }
  syncFiles() {
    return this.app.vault.getMarkdownFiles().filter((f) => !this.settings.root || f.path.startsWith(this.settings.root + "/"));
  }
  async openLinked(user, key) {
    const tag = marker(user, { key }), matches = [];
    for (const f of this.syncFiles()) if ((await this.app.vault.cachedRead(f)).includes(tag)) matches.push(f);
    if (matches.length !== 1) throw Error(matches.length ? "\u53D1\u73B0\u91CD\u590D\u5173\u8054\uFF0C\u8BF7\u5148\u6574\u7406\u7B14\u8BB0" : "\u5F53\u524D\u7B14\u8BB0\u5E93\u5C1A\u672A\u627E\u5230\u5173\u8054\uFF0C\u8BF7\u6253\u5F00\u6B63\u786E\u7684\u5E93\u5E76\u5B8C\u6210 Git Pull \u540E\u91CD\u8BD5");
    await this.app.workspace.getLeaf(false).openFile(matches[0]);
  }
  async openAnnotation(k) {
    if (!this.cloud) {
      new Connect(this, () => this.openAnnotation(k)).open();
      return;
    }
    try {
      new Associate(this, annotation(await this.cloud.item(k))).open();
    } catch (e) {
      new Notice(e.message, 12e3);
    }
  }
  async browse() {
    if (!this.cloud) {
      new Connect(this, () => this.browse()).open();
      return;
    }
    try {
      const rows = await this.cloud.recent(), valid = [];
      for (const row of rows) {
        try {
          valid.push(annotation(row));
        } catch {
        }
      }
      if (!valid.length) {
        new Notice("\u6700\u8FD1 100 \u6761\u6279\u6CE8\u4E2D\u6CA1\u6709\u53EF\u7528\u7684 PDF \u6279\u6CE8\u3002\u8BF7\u5148\u5728 Zotero \u540C\u6B65\u3002");
        return;
      }
      new Pick(this.app, valid, (a) => `\u7B2C ${a.page} \u9875 \xB7 ${a.quote.slice(0, 160)} \xB7 ${a.key}`, (a) => new Associate(this, a).open()).open();
    } catch (e) {
      new Notice(e.message, 12e3);
    }
  }
  associate(a, title, target, reverse) {
    const cloud = this.cloud;
    const task = this.queue.catch(() => {
    }).then(() => this.doAssociate(cloud, a, title, target, reverse));
    this.queue = task;
    return task;
  }
  async doAssociate(cloud, a, title, target, reverse) {
    if (!cloud) throw Error("\u8BF7\u5148\u8FDE\u63A5 Zotero");
    const vault = this.app.vault, tag = marker(cloud.user, a), matches = [];
    if (this.settings.root && !vault.getAbstractFileByPath(this.settings.root)) throw Error("\u540C\u6B65\u5B50\u76EE\u5F55\u4E0D\u5B58\u5728\uFF0C\u8BF7\u68C0\u67E5\u77E5\u8BC6\u6865\u624B\u673A\u6269\u5C55\u8BBE\u7F6E\uFF1A" + this.settings.root);
    if (target && this.settings.root && !target.path.startsWith(this.settings.root + "/")) throw Error("\u6240\u9009\u7B14\u8BB0\u4E0D\u5728\u540C\u6B65\u76EE\u5F55\u5185");
    for (const f of this.syncFiles()) {
      const text = await vault.cachedRead(f);
      if (text.includes(tag) || text.includes("](" + a.pdf + ")")) matches.push(f);
    }
    if (matches.length > 1) throw Error("\u591A\u7BC7\u7B14\u8BB0\u5305\u542B\u8BE5\u6279\u6CE8\uFF0C\u8BF7\u5148\u5408\u5E76\u6216\u79FB\u9664\u91CD\u590D\u5173\u8054");
    let file = matches[0];
    if (file && target && file.path !== target.path) throw Error("\u8BE5\u6279\u6CE8\u5DF2\u5173\u8054\uFF1A" + file.path + "\u3002\u672C\u6B21\u4E0D\u4F1A\u521B\u5EFA\u7B2C\u4E8C\u4EFD\u5173\u8054\u3002");
    if (!file && target) {
      if (!(target instanceof TFile) || vault.getAbstractFileByPath(target.path) !== target) throw Error("\u6240\u9009\u7B14\u8BB0\u5DF2\u79FB\u52A8\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9");
      await vault.process(target, (text) => text.includes(tag) || text.includes("](" + a.pdf + ")") ? text : text + "\n\n" + block(cloud.user, a));
      file = target;
    }
    if (!file) {
      title = title.trim() || "\u6279\u6CE8-" + a.key;
      if (/[\\/:*?"<>|\r\n]/.test(title) || title.length > 100 || title.endsWith(".") || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(title)) throw Error("\u7B14\u8BB0\u540D\u79F0\u65E0\u6548");
      const folder = (this.settings.root ? this.settings.root + "/" : "") + "\u77E5\u8BC6\u6865\u624B\u673A";
      if (!vault.getAbstractFileByPath(folder)) await vault.createFolder(folder);
      let path = folder + "/" + title + ".md", n = 1;
      while (vault.getAbstractFileByPath(path)) path = folder + "/" + title + " " + n++ + ".md";
      file = await vault.create(path, block(cloud.user, a));
    }
    await vault.process(file, (text) => text.includes(tag) ? text : text + "\n\n" + tag + "\n");
    if (!reverse) return { file, ok: true, message: "\u5DF2\u5EFA\u7ACB\u672C\u5730\u5173\u8054\uFF0C\u53EF\u4ECE\u7B14\u8BB0\u8FD4\u56DE Zotero PDF" };
    try {
      const id = tag + file.path;
      if (!this.writeTokens.has(id)) this.writeTokens.set(id, globalThis.crypto.randomUUID().replace(/-/g, ""));
      await cloud.backlink(a, vault.getName(), file.path, this.writeTokens.get(id));
      return { file, ok: true, message: "\u53CC\u5411\u5173\u8054\u5DF2\u5EFA\u7ACB\uFF1B\u8BF7\u5728 Zotero \u540C\u6B65\u540E\u6253\u5F00\u7236\u6587\u732E\u4E0B\u7684\u77E5\u8BC6\u6865\u7B14\u8BB0" };
    } catch (e) {
      return { file, ok: false, message: "\u672C\u5730\u5173\u8054\u5DF2\u4FDD\u5B58\uFF1A" + file.path + "\u3002Zotero \u8FD4\u56DE\u94FE\u63A5\u5C1A\u672A\u786E\u8BA4\uFF1A" + e.message + "\u3002\u518D\u6B21\u70B9\u51FB\u201C\u5EFA\u7ACB\u5173\u8054\u201D\u4F1A\u590D\u7528\u672C\u5730\u7B14\u8BB0\u3002" };
    }
  }
};
