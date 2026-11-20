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
        if (r.status === 401) throw Error("Zotero \u5BC6\u94A5\u65E0\u6548\u6216\u5DF2\u64A4\u9500\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5");
        if (r.status === 403) throw Error(method === "GET" ? "Zotero \u8BFB\u53D6\u6743\u9650\u4E0D\u8DB3\uFF0C\u8BF7\u4E3A\u5BC6\u94A5\u5F00\u542F Allow library access \u548C Allow notes access" : "Zotero \u5199\u5165\u6743\u9650\u4E0D\u8DB3\uFF0C\u8BF7\u4E3A\u5BC6\u94A5\u5F00\u542F Allow write access");
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

// src/chooser.js
var require_chooser = __commonJS({
  "src/chooser.js"(exports2, module2) {
    var { Modal: Modal2, Setting: Setting2, TFile: TFile2, TFolder: TFolder2, Notice: Notice2 } = require("obsidian");
    var Associate2 = class extends Modal2 {
      constructor(p, a) {
        super(p.app);
        this.p = p;
        this.a = a;
        this.title = "";
        this.mode = "note";
        this.folder = p.settings.root || "";
        this.target = null;
        this.reverse = !a.origin;
        this.busy = false;
      }
      onOpen() {
        this.titleEl.setText("\u65B0\u5EFA / \u5173\u8054\u77E5\u8BC6\u70B9");
        this.contentEl.addClass("kbm-chooser");
        this.contentEl.createEl("blockquote", { text: this.a.quote });
        if (!this.a.origin) this.contentEl.createEl("p", { text: "Zotero \xB7 \u7B2C " + this.a.page + " \u9875" });
        this.modeEl = this.contentEl.createDiv({ cls: "kbm-modes" });
        this.modeButtons = [];
        for (const [mode, label] of [["note", "\u65B0\u5EFA\u7B14\u8BB0"], ["folder", "\u65B0\u5EFA\u6587\u4EF6\u5939"], ["existing", "\u5173\u8054\u5DF2\u6709\u7B14\u8BB0"]]) {
          const b = this.modeEl.createEl("button", { text: label });
          this.modeButtons.push([mode, b]);
          b.onclick = () => {
            if (this.busy) return;
            this.mode = mode;
            this.target = null;
            this.render();
          };
        }
        this.nameSetting = new Setting2(this.contentEl).setName("\u540D\u79F0").addText((t) => {
          this.nameInput = t;
          t.setPlaceholder("\u8F93\u5165\u540D\u79F0").onChange((v) => this.title = v);
        });
        this.browser = this.contentEl.createDiv({ cls: "kbm-browser" });
        if (!this.a.origin) new Setting2(this.contentEl).setName("\u5728 Zotero \u6DFB\u52A0\u8FD4\u56DE\u94FE\u63A5").addToggle((t) => t.setValue(true).onChange((v) => this.reverse = v));
        this.status = this.contentEl.createEl("p", { attr: { role: "status", "aria-live": "polite" } });
        this.submit = this.contentEl.createEl("button", { text: "\u521B\u5EFA\u5E76\u6253\u5F00", cls: "mod-cta kbm-submit" });
        this.submit.onclick = () => this.run();
        this.render();
      }
      render() {
        for (const [mode, b] of this.modeButtons) {
          b.classList.toggle("mod-cta", mode === this.mode);
          b.setAttribute("aria-pressed", String(mode === this.mode));
          b.disabled = this.busy;
        }
        this.nameSetting.settingEl.style.display = this.mode === "existing" ? "none" : "";
        this.browser.empty();
        const root = this.p.settings.root || "", current = this.folder ? this.app.vault.getAbstractFileByPath(this.folder) : this.app.vault.getRoot();
        const relative = this.folder.slice(root.length).replace(/^\//, "");
        this.browser.createEl("p", { text: "\u5F53\u524D\u4F4D\u7F6E\uFF1A" + (relative || "\u540C\u6B65\u4ED3\u5E93\u6839\u76EE\u5F55"), cls: "kbm-location" });
        const up = this.browser.createEl("button", { text: "\u2191 \u4E0A\u4E00\u7EA7" });
        up.disabled = this.folder === root || this.busy;
        up.onclick = () => {
          this.folder = this.folder.includes("/") ? this.folder.slice(0, this.folder.lastIndexOf("/")) : "";
          if (root && !this.folder.startsWith(root)) this.folder = root;
          this.target = null;
          this.render();
        };
        const list = this.browser.createDiv({ cls: "kbm-entries" });
        if (!current || !Array.isArray(current.children)) {
          list.createEl("p", { text: "\u6B64\u6587\u4EF6\u5939\u4E0D\u5B58\u5728\uFF0C\u8BF7\u68C0\u67E5\u540C\u6B65\u4ED3\u5E93\u5B50\u76EE\u5F55\u8BBE\u7F6E\u3002" });
        } else {
          const children = [...current.children].filter((f) => f instanceof TFolder2 || this.mode === "existing" && f instanceof TFile2 && f.extension === "md").sort((a, b) => (a instanceof TFolder2 ? 0 : 1) - (b instanceof TFolder2 ? 0 : 1) || a.name.localeCompare(b.name, "zh-CN"));
          for (const child of children) {
            if (child.name.startsWith(".")) continue;
            const folder = child instanceof TFolder2;
            const b = list.createEl("button", { text: (folder ? "\u{1F4C1} " : "\u{1F4C4} ") + child.name + (folder ? "  \u203A" : ""), cls: "kbm-entry" });
            b.disabled = this.busy;
            if (this.target === child) b.classList.add("mod-cta");
            b.onclick = () => {
              if (folder) {
                this.folder = child.path;
                this.target = null;
              } else this.target = child;
              this.render();
            };
          }
          if (!children.length) list.createEl("p", { text: this.mode === "existing" ? "\u6B64\u5904\u6CA1\u6709\u5B50\u6587\u4EF6\u5939\u6216 Markdown \u7B14\u8BB0" : "\u6B64\u5904\u6CA1\u6709\u5B50\u6587\u4EF6\u5939\uFF0C\u53EF\u76F4\u63A5\u5728\u8FD9\u91CC\u521B\u5EFA" });
        }
        this.submit.textContent = this.busy ? "\u6B63\u5728\u5EFA\u7ACB\u5173\u8054\u2026" : this.mode === "existing" ? "\u5173\u8054\u5E76\u6253\u5F00" : this.mode === "folder" ? "\u521B\u5EFA\u6587\u4EF6\u5939\u5E76\u6253\u5F00" : "\u521B\u5EFA\u7B14\u8BB0\u5E76\u6253\u5F00";
        this.submit.disabled = this.busy || this.mode === "existing" && !this.target;
        this.status.setText(this.mode === "existing" ? this.target ? "\u5DF2\u9009\u62E9\uFF1A" + this.target.name : "\u9010\u5C42\u8FDB\u5165\u6587\u4EF6\u5939\uFF0C\u518D\u70B9\u9009\u76EE\u6807\u7B14\u8BB0" : this.mode === "folder" ? "\u5728\u5F53\u524D\u4F4D\u7F6E\u65B0\u5EFA\u6587\u4EF6\u5939\uFF0C\u5185\u90E8\u521B\u5EFA\u201C\u9ED8\u8BA4.md\u201D\u4F5C\u4E3A\u5173\u8054\u5165\u53E3" : "\u5728\u5F53\u524D\u4F4D\u7F6E\u65B0\u5EFA\u7B14\u8BB0");
      }
      async run() {
        if (this.busy) return;
        this.busy = true;
        this.render();
        try {
          let opened = false;
          const openSaved = async (file) => {
            await this.p.openVisible(file);
            opened = true;
            this.close();
            new Notice2("\u5DF2\u6253\u5F00\uFF1A" + file.path + (this.reverse ? "\n\u6B63\u5728\u6DFB\u52A0 Zotero \u8FD4\u56DE\u94FE\u63A5\u2026" : ""), 1e4);
          };
          const options = { folder: this.folder, kind: this.mode === "folder" ? "folder" : "note", onLocalSaved: openSaved };
          const result = this.a.origin ? await this.p.associateSource(this.a, this.title, this.target, options) : await this.p.associate(this.a, this.title, this.target, this.reverse, options);
          if (result.file) {
            if (!opened) await openSaved(result.file);
            new Notice2(result.message, result.ok ? 1e4 : 3e4);
          } else {
            this.busy = false;
            this.render();
            this.status.setText(result.message);
          }
        } catch (e) {
          this.busy = false;
          this.render();
          this.status.setText(e.message);
        }
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    module2.exports = Associate2;
  }
});

// src/selection.js
var require_selection = __commonJS({
  "src/selection.js"(exports2, module2) {
    var { TFile: TFile2, MarkdownView, Notice: Notice2 } = require("obsidian");
    var valid = (id) => /^[a-f0-9-]{36}$/i.test(id || "");
    var stamp = (id, side) => `<!-- kbm-${side}:${id} -->`;
    var uri = (id, side) => `obsidian://knowledge-bridge-mobile?action=selection&id=${id}&side=${side}`;
    var label = (s) => s.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
    module2.exports = {
      captureSource(editor, view) {
        if (view?.getMode?.() === "preview") {
          const selection = view.containerEl.ownerDocument.defaultView.getSelection(), quote2 = selection?.toString() || "";
          if (!quote2.trim() || !view.contentEl.contains(selection.anchorNode) || !view.contentEl.contains(selection.focusNode)) throw Error("\u8BF7\u5148\u5728\u5F53\u524D\u7B14\u8BB0\u9009\u4E2D\u6587\u5B57");
          const text2 = view.data || "", start = text2.indexOf(quote2);
          if (start < 0 || text2.indexOf(quote2, start + 1) >= 0) throw Error("\u9605\u8BFB\u6A21\u5F0F\u65E0\u6CD5\u552F\u4E00\u5B9A\u4F4D\u6B64\u9009\u533A\uFF0C\u8BF7\u5207\u6362\u7F16\u8F91\u6A21\u5F0F\u91CD\u65B0\u9009\u62E9");
          return { quote: quote2, id: globalThis.crypto.randomUUID(), origin: { file: view.file.path, start, end: start + quote2.length, quote: quote2, text: text2, view: null } };
        }
        if (!view?.file || !editor?.getSelection()?.trim()) throw Error("\u8BF7\u5728 Obsidian \u7F16\u8F91\u6A21\u5F0F\u9009\u4E2D\u539F\u53E5\uFF0C\u518D\u70B9\u201C\u65B0\u5EFA / \u5173\u8054\u77E5\u8BC6\u70B9\u201D");
        const quote = editor.getSelection(), text = editor.getValue(), from = editor.getCursor("from"), to = editor.getCursor("to");
        if (quote.length > 5e4) throw Error("\u9009\u533A\u8FC7\u957F\uFF0C\u8BF7\u7F29\u5C0F\u5230\u9700\u8981\u5173\u8054\u7684\u6BB5\u843D");
        if (quote.includes("obsidian://knowledge-bridge-mobile")) throw Error("\u6B64\u9009\u533A\u5DF2\u5305\u542B\u77E5\u8BC6\u6865\u94FE\u63A5\uFF0C\u8BF7\u76F4\u63A5\u70B9\u51FB\u94FE\u63A5\u6253\u5F00");
        return { quote, id: globalThis.crypto.randomUUID(), origin: { file: view.file.path, start: editor.posToOffset(from), end: editor.posToOffset(to), quote, text, view } };
      },
      async openSourceLink(id, side) {
        if (!valid(id) || !["source", "target"].includes(side)) throw Error("\u65E0\u6548\u77E5\u8BC6\u70B9\u94FE\u63A5");
        const token = stamp(id, side), matches = [];
        for (const f of this.syncFiles()) if ((await this.app.vault.cachedRead(f)).includes(token)) matches.push(f);
        if (matches.length !== 1) throw Error(matches.length ? "\u5B58\u5728\u91CD\u590D\u7684\u5173\u8054\u7B14\u8BB0\uFF0C\u8BF7\u5148\u6574\u7406" : "\u672A\u627E\u5230\u5173\u8054\uFF0C\u8BF7\u6253\u5F00\u6B63\u786E\u7684\u7B14\u8BB0\u5E93\u5E76\u540C\u6B65\u540E\u91CD\u8BD5");
        const file = matches[0], text = await this.app.vault.read(file), offset = text.indexOf(token), line = text.slice(0, offset).split("\n").length - 1;
        await this.openVisible(file, { eState: { line } });
      },
      associateSource(a, title, target, options) {
        const task = this.queue.catch(() => {
        }).then(() => this.doAssociateSource(a, title, target, options));
        this.queue = task;
        return task;
      },
      async doAssociateSource(a, title, target, options) {
        const vault = this.app.vault, o = a.origin, source = vault.getAbstractFileByPath(o.file);
        if (!(source instanceof TFile2) || !this.syncFiles().includes(source)) throw Error("\u539F\u7B14\u8BB0\u4E0D\u5728\u540C\u6B65\u76EE\u5F55\u5185\u6216\u5DF2\u79FB\u52A8");
        if (target === source) throw Error("\u8BF7\u9009\u62E9\u539F\u7B14\u8BB0\u4EE5\u5916\u7684\u4F4D\u7F6E");
        const view = o.view?.file?.path === o.file && o.view.editor ? o.view : null;
        const current = view ? view.editor.getValue() : await vault.read(source);
        const existing = [];
        for (const f of this.syncFiles()) if ((await vault.cachedRead(f)).includes(stamp(a.id, "target"))) existing.push(f);
        if (existing.length > 1) throw Error("\u5B58\u5728\u91CD\u590D\u76EE\u6807\uFF0C\u8BF7\u5148\u6574\u7406");
        if (current.includes(stamp(a.id, "source")) && existing.length === 1) return { file: existing[0], ok: true, message: "\u5DF2\u6253\u5F00\u539F\u6709\u5173\u8054" };
        if (current !== o.text || current.slice(o.start, o.end) !== a.quote) throw Error("\u539F\u7B14\u8BB0\u5185\u5BB9\u5DF2\u53D8\u5316\uFF0C\u8BF7\u5173\u95ED\u7A97\u53E3\u540E\u91CD\u65B0\u9009\u4E2D\u539F\u53E5");
        const adapter = vault.adapter, backup = this.app.vault.configDir + "/plugins/" + this.manifest.id + "/source-backups";
        if (!await adapter.exists(backup)) await adapter.mkdir(backup);
        if (!await adapter.exists(backup + "/" + a.id + ".md")) await adapter.write(backup + "/" + a.id + ".md", current);
        const content = stamp(a.id, "target") + "\n[\u8FD4\u56DE Obsidian \u539F\u53E5](" + uri(a.id, "source") + ")\n\n" + a.quote.split("\n").map((s) => "> " + s).join("\n") + "\n\n";
        let file = existing[0];
        if (!file && target) {
          if (!this.syncFiles().includes(target)) throw Error("\u76EE\u6807\u7B14\u8BB0\u4E0D\u5728\u540C\u6B65\u76EE\u5F55\u5185");
          await vault.process(target, (text) => text + "\n\n" + content);
          file = target;
        }
        if (!file) file = await this.createDestination(title, content, options);
        const replacement = stamp(a.id, "source") + a.quote.split("\n").map((s) => s ? "==[" + label(s) + "](" + uri(a.id, "target") + ")==" : s).join("\n");
        if (view) {
          if (view.editor.getValue() !== current) throw Error("\u76EE\u6807\u5DF2\u4FDD\u5B58\uFF0C\u4F46\u539F\u6587\u521A\u521A\u6539\u53D8\u3002\u8BF7\u6062\u590D\u539F\u9009\u533A\u5185\u5BB9\u540E\u91CD\u8BD5\uFF0C\u6216\u91CD\u65B0\u9009\u62E9\uFF1B\u76EE\u6807\u4E0D\u4F1A\u88AB\u5220\u9664");
          view.editor.replaceRange(replacement, view.editor.offsetToPos(o.start), view.editor.offsetToPos(o.end));
          await view.save();
        } else await vault.process(source, (text) => {
          if (text !== current) throw Error("\u76EE\u6807\u5DF2\u4FDD\u5B58\uFF0C\u4F46\u539F\u6587\u521A\u521A\u6539\u53D8\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9");
          return text.slice(0, o.start) + replacement + text.slice(o.end);
        });
        return { file, ok: true, message: "\u5DF2\u5EFA\u7ACB\u539F\u53E5\u4E0E\u77E5\u8BC6\u70B9\u7684\u53CC\u5411\u94FE\u63A5" };
      },
      installSelectionUI() {
        this.selectionBars = /* @__PURE__ */ new Map();
        const launch = (editor, view) => {
          try {
            this.showAssociate(this.captureSource(editor, view));
          } catch (e) {
            new Notice2(e.message);
          }
        };
        this.addCommand({ id: "selection-create", name: "\u9009\u4E2D\u6587\u5B57\uFF1A\u65B0\u5EFA / \u5173\u8054\u77E5\u8BC6\u70B9", editorCallback: (editor, view) => launch(editor, view) });
        this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, view) => {
          if (!editor.getSelection()?.trim()) return;
          menu.addItem((i) => i.setTitle("\u65B0\u5EFA / \u5173\u8054\u77E5\u8BC6\u70B9").setIcon("link").onClick(() => launch(editor, view)));
        }));
        const refresh = () => {
          if (this.disposed) return;
          const active = /* @__PURE__ */ new Set();
          for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
            const view = leaf.view;
            if (!view?.containerEl?.ownerDocument || !view?.contentEl?.before) continue;
            active.add(view);
            if (this.selectionBars.get(view)?.isConnected) continue;
            this.selectionBars.get(view)?.remove();
            const bar = view.containerEl.ownerDocument.createElement("div");
            bar.className = "kbm-selection";
            const b = bar.createEl("button", { text: "\u9009\u533A \u2192 \u65B0\u5EFA / \u5173\u8054" });
            let selected;
            b.onpointerdown = (e) => {
              try {
                selected = this.captureSource(view.editor, view);
              } catch {
                selected = null;
              }
              e.preventDefault();
            };
            b.onclick = () => {
              try {
                this.showAssociate(selected || this.captureSource(view.editor, view));
                selected = null;
              } catch (e) {
                new Notice2(e.message);
              }
            };
            const z = bar.createEl("button", { text: "Zotero \u6279\u6CE8" });
            z.onclick = () => this.browse();
            view.contentEl.before(bar);
            this.selectionBars.set(view, bar);
          }
          for (const [view, bar] of this.selectionBars) if (!active.has(view)) {
            bar.remove();
            this.selectionBars.delete(view);
          }
        };
        const safeRefresh = () => {
          try {
            refresh();
          } catch (e) {
            const message = "\u9009\u533A\u5DE5\u5177\u680F\uFF1A" + String(e.message || e);
            this.startupWarnings || (this.startupWarnings = []);
            if (!this.startupWarnings.includes(message)) {
              this.startupWarnings.push(message);
              new Notice2("\u77E5\u8BC6\u6865\u5DE5\u5177\u680F\u6682\u672A\u5C31\u7EEA\uFF1B\u53EF\u7528\u547D\u4EE4\u201C\u9009\u4E2D\u6587\u5B57\uFF1A\u65B0\u5EFA / \u5173\u8054\u77E5\u8BC6\u70B9\u201D\u3002\u8BCA\u65AD\u89C1\u63D2\u4EF6\u8BBE\u7F6E\u3002", 12e3);
            }
          }
        };
        this.registerEvent(this.app.workspace.on("layout-change", safeRefresh));
        this.registerEvent(this.app.workspace.on("active-leaf-change", safeRefresh));
        this.registerEvent(this.app.workspace.on("file-open", safeRefresh));
        this.app.workspace.onLayoutReady(safeRefresh);
      }
    };
  }
});

// src/main.js
var { Plugin, PluginSettingTab, Modal, Setting, FuzzySuggestModal, Notice, TFile, TFolder, requestUrl, Platform } = require("obsidian");
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
    if (this.p.startupWarnings?.length) this.containerEl.createEl("p", { text: "\u542F\u52A8\u8BCA\u65AD\uFF1A" + this.p.startupWarnings.join("\uFF1B") });
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
var Associate = require_chooser();
module.exports = class MobileBridge extends Plugin {
  async onload() {
    this.disposed = false;
    this.startupWarnings = [];
    this.writeTokens = /* @__PURE__ */ new Map();
    const saved = await this.loadData();
    let autoRoot = "";
    if (saved?.root == null && Platform.isMobileApp) {
      try {
        if (await this.app.vault.adapter.exists("notes/.git")) autoRoot = "notes";
      } catch {
        this.startupWarnings.push("\u65E0\u6CD5\u81EA\u52A8\u68C0\u6D4B\u540C\u6B65\u76EE\u5F55\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u586B\u5199 notes");
      }
    }
    this.settings = { user: String(saved?.user || ""), root: saved?.root ?? autoRoot };
    this.cloud = null;
    this.queue = Promise.resolve();
    this.writeTokens = /* @__PURE__ */ new Map();
    Object.assign(this, require_selection());
    this.addSettingTab(new Settings(this));
    this.addCommand({ id: "connect", name: "\u8FDE\u63A5 Zotero \u4E91\u7AEF", callback: () => new Connect(this).open() });
    this.addCommand({ id: "link-annotation", name: "\u4ECE Zotero \u6279\u6CE8\u65B0\u5EFA / \u5173\u8054\u7B14\u8BB0", callback: () => this.browse() });
    this.addRibbonIcon("link", "\u77E5\u8BC6\u6865\uFF1A\u5173\u8054 Zotero \u6279\u6CE8", () => this.browse());
    this.registerObsidianProtocolHandler("knowledge-bridge-mobile", (params) => {
      if (params.vault && params.vault !== this.app.vault.getName()) {
        new Notice("\u8BF7\u5148\u6253\u5F00\u7B14\u8BB0\u5E93\uFF1A" + params.vault);
        return;
      }
      if (params.action === "selection") {
        this.openSourceLink(params.id, params.side).catch((e) => new Notice(e.message, 12e3));
        return;
      }
      if (params.action === "open") {
        this.openLinked(params.user, params.annotation).catch((e) => new Notice(e.message, 12e3));
        return;
      }
      if (params.annotation) this.openAnnotation(params.annotation);
      else this.browse();
    });
    this.installSelectionUI();
  }
  onunload() {
    this.disposed = true;
    this.cloud = null;
    this.writeTokens?.clear();
    for (const bar of this.selectionBars?.values() || []) bar.remove();
  }
  showAssociate(a) {
    new Associate(this, a).open();
  }
  syncFiles() {
    return this.app.vault.getMarkdownFiles().filter((f) => !this.settings.root || f.path.startsWith(this.settings.root + "/"));
  }
  async openVisible(file, state = {}) {
    const w = this.app.workspace, leaf = w.getLeaf(false);
    await leaf.openFile(file, { active: true, ...state });
    if (w.revealLeaf) await w.revealLeaf(leaf);
    if (Platform?.isMobileApp) {
      w.leftSplit?.collapse?.();
      w.rightSplit?.collapse?.();
    }
  }
  async openLinked(user, key) {
    const tag = marker(user, { key }), matches = [];
    for (const f of this.syncFiles()) if ((await this.app.vault.cachedRead(f)).includes(tag)) matches.push(f);
    if (matches.length !== 1) throw Error(matches.length ? "\u53D1\u73B0\u91CD\u590D\u5173\u8054\uFF0C\u8BF7\u5148\u6574\u7406\u7B14\u8BB0" : "\u5F53\u524D\u7B14\u8BB0\u5E93\u5C1A\u672A\u627E\u5230\u5173\u8054\uFF0C\u8BF7\u6253\u5F00\u6B63\u786E\u7684\u5E93\u5E76\u5B8C\u6210 Git Pull \u540E\u91CD\u8BD5");
    const text = await this.app.vault.cachedRead(matches[0]);
    await this.openVisible(matches[0], { eState: { line: text.slice(0, text.indexOf(tag)).split("\n").length - 1 } });
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
  associate(a, title, target, reverse, options) {
    const cloud = this.cloud;
    const task = this.queue.catch(() => {
    }).then(() => this.doAssociate(cloud, a, title, target, reverse, options));
    this.queue = task;
    return task;
  }
  async createDestination(title, content, options) {
    const vault = this.app.vault, root = this.settings.root || "";
    title = title.trim() || "\u672A\u547D\u540D";
    if (/[\\/:*?"<>|\r\n]/.test(title) || title.length > 100 || title.endsWith(".") || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(title)) throw Error("\u7B14\u8BB0\u540D\u79F0\u65E0\u6548");
    const folder = options?.folder ?? (root ? root + "/" : "") + "\u77E5\u8BC6\u6865\u624B\u673A";
    if (root && folder !== root && !folder.startsWith(root + "/")) throw Error("\u4F4D\u7F6E\u4E0D\u5728\u540C\u6B65\u76EE\u5F55\u5185");
    if (folder.split("/").some((s) => s === "." || s === "..") || folder.startsWith("/") || folder.includes("\\")) throw Error("\u65E0\u6548\u4F4D\u7F6E");
    if (folder && !vault.getAbstractFileByPath(folder)) {
      if (options) throw Error("\u6240\u9009\u6587\u4EF6\u5939\u5DF2\u79FB\u52A8\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9");
      await vault.createFolder(folder);
    }
    const isFolder = options?.kind === "folder", prefix = folder ? folder + "/" : "";
    let path = prefix + title + (isFolder ? "" : ".md"), n = 1;
    while (vault.getAbstractFileByPath(path)) path = prefix + title + " " + n++ + (isFolder ? "" : ".md");
    if (isFolder) {
      await vault.createFolder(path);
      path += "/\u9ED8\u8BA4.md";
    }
    return vault.create(path, content);
  }
  async doAssociate(cloud, a, title, target, reverse, options) {
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
      file = await this.createDestination(title || "\u6279\u6CE8-" + a.key, block(cloud.user, a), options);
    }
    await vault.process(file, (text) => text.includes(tag) ? text : text + "\n\n" + tag + "\n");
    if (options?.onLocalSaved) await options.onLocalSaved(file);
    if (!reverse) return { file, ok: true, message: "\u5DF2\u5EFA\u7ACB\u672C\u5730\u5173\u8054\uFF0C\u53EF\u4ECE\u7B14\u8BB0\u8FD4\u56DE Zotero PDF" };
    try {
      const id = tag + file.path;
      if (!this.writeTokens.has(id)) this.writeTokens.set(id, globalThis.crypto.randomUUID().replace(/-/g, ""));
      await cloud.backlink(a, vault.getName(), file.path, this.writeTokens.get(id));
      return { file, ok: true, message: "\u53CC\u5411\u5173\u8054\u5DF2\u5EFA\u7ACB\uFF1B\u8BF7\u5728 Zotero \u540C\u6B65\u540E\u6253\u5F00\u7236\u6587\u732E\u4E0B\u7684\u77E5\u8BC6\u6865\u7B14\u8BB0" };
    } catch (e) {
      return { file, ok: false, message: "\u7B14\u8BB0\u5DF2\u4FDD\u5B58\u5E76\u4FDD\u7559\uFF1A" + file.path + "\u3002Zotero \u8FD4\u56DE\u94FE\u63A5\u672A\u5B8C\u6210\uFF1A" + e.message + "\u3002\u4FEE\u590D\u8FDE\u63A5\u540E\u518D\u6B21\u9009\u62E9\u540C\u4E00\u6279\u6CE8\u5373\u53EF\u91CD\u8BD5\uFF0C\u4E0D\u4F1A\u91CD\u590D\u521B\u5EFA\u3002" };
    }
  }
};
