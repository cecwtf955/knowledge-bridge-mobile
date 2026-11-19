const {Plugin,PluginSettingTab,Modal,Setting,FuzzySuggestModal,Notice,TFile,requestUrl,Platform}=require('obsidian');
const {Cloud,annotation,marker,block}=require('./core');

class Pick extends FuzzySuggestModal {
  constructor(app,rows,label,choose){super(app);this.rows=rows;this.label=label;this.choose=choose;}
  getItems(){return this.rows;}
  getItemText(x){return this.label(x);}
  onChooseItem(x){Promise.resolve().then(()=>this.choose(x)).catch(e=>new Notice(e.message,12000));}
}
class Connect extends Modal {
  constructor(p,done){super(p.app);this.p=p;this.done=done;}
  onOpen(){
    this.titleEl.setText('连接 Zotero');
    this.contentEl.createEl('p',{text:'在 Zotero 网站的 Settings → Feeds/API 创建个人库密钥。读取批注需读取权限；添加返回笔记的链接需写入权限。密钥只保存在本次运行内存中，关闭插件后需重新输入。'});
    this.contentEl.createEl('a',{text:'打开 Zotero 密钥设置',href:'https://www.zotero.org/settings/keys'});
    let user=this.p.settings.user,token='';
    new Setting(this.contentEl).setName('数字用户 ID').addText(t=>t.setValue(user).onChange(v=>user=v.trim()));
    new Setting(this.contentEl).setName('API 密钥').addText(t=>{t.inputEl.type='password';t.onChange(v=>token=v.trim());});
    const status=this.contentEl.createEl('p');
    new Setting(this.contentEl).addButton(b=>b.setButtonText('连接').setCta().onClick(async()=>{
      b.setDisabled(true);
      try {
        const cloud=new Cloud(requestUrl,user,token);
        await cloud.call(`/users/${user}/items?limit=1`);
        this.p.cloud=cloud;this.p.settings.user=user;await this.p.saveData(this.p.settings);
        this.close();if(this.done)await this.done();else new Notice('已连接 Zotero');
      }catch(e){status.setText(e.message);}finally{b.setDisabled(false);}
    }));
  }
  onClose(){this.contentEl.empty();}
}
class Settings extends PluginSettingTab {
  constructor(p){super(p.app,p);this.p=p;}
  display(){
    this.containerEl.empty();
    this.containerEl.createEl('h2',{text:'知识桥 · 手机扩展'});
    this.containerEl.createEl('p',{text:'使用 Zotero 云端个人库，不需要电脑开机。请先在手机 Zotero 完成批注同步。'});
    new Setting(this.containerEl).setName('Zotero 连接').addButton(b=>b.setButtonText('连接 / 切换账号').onClick(()=>new Connect(this.p).open()));
    new Setting(this.containerEl).setName('同步仓库子目录').setDesc('若 Git 仓库放在 notes 子文件夹中，请填写 notes；直接打开 Git 仓库时留空。').addText(t=>t.setValue(this.p.settings.root).setPlaceholder('notes 或留空').onChange(async v=>{
      const root=v.trim();if(root&&(!/^[^\\:*?"<>|]+$/.test(root)||root.split('/').some(s=>!s||s==='.'||s==='..')))return;
      this.p.settings.root=root;await this.p.saveData(this.p.settings);
    }));
    new Setting(this.containerEl).setName('断开连接').addButton(b=>b.setButtonText('清除内存中的密钥').onClick(()=>{this.p.cloud=null;new Notice('已断开');}));
  }
}
class Associate extends Modal {
  constructor(p,a){super(p.app);this.p=p;this.a=a;this.title='';this.target=null;this.reverse=true;}
  onOpen(){
    this.titleEl.setText('关联 Zotero 批注');
    this.contentEl.createEl('blockquote',{text:this.a.quote});
    this.contentEl.createEl('p',{text:'PDF 第 '+this.a.page+' 页；批注 '+this.a.key});
    new Setting(this.contentEl).setName('新笔记名称').setDesc('保存在 '+(this.p.settings.root?this.p.settings.root+'/':'')+'知识桥手机，也可选择已有笔记。').addText(t=>t.setPlaceholder('留空使用批注编号').onChange(v=>this.title=v));
    const selected=this.contentEl.createEl('p',{text:'目标：新建笔记'});
    new Setting(this.contentEl).setName('关联已有笔记').addButton(b=>b.setButtonText('选择').onClick(()=>new Pick(this.app,this.p.syncFiles(),f=>f.path,f=>{this.target=f;selected.setText('目标：'+f.path);}).open()))
      .addButton(b=>b.setButtonText('改为新建').onClick(()=>{this.target=null;selected.setText('目标：新建笔记');}));
    new Setting(this.contentEl).setName('在 Zotero 添加返回链接').setDesc('在父文献下新增一条知识桥笔记，供手机 Zotero 跳回 Obsidian。').addToggle(t=>t.setValue(true).onChange(v=>this.reverse=v));
    const status=this.contentEl.createEl('p');
    new Setting(this.contentEl).addButton(b=>b.setButtonText('建立关联').setCta().onClick(async()=>{
      b.setDisabled(true);
      try{
        if(!this.p.cloud)throw Error('请先重新连接 Zotero');
        const result=await this.p.associate(this.a,this.title,this.target,this.reverse);
        status.setText(result.message);
        await this.app.workspace.getLeaf(false).openFile(result.file);
        if(result.ok){new Notice(result.message);this.close();}
      }catch(e){status.setText(e.message);}finally{b.setDisabled(false);}
    }));
  }
  onClose(){this.contentEl.empty();}
}
module.exports=class MobileBridge extends Plugin {
  async onload(){
    const saved=await this.loadData();
    const autoRoot=Platform.isMobileApp&&await this.app.vault.adapter.exists('notes/.git')?'notes':'';
    this.settings={user:String(saved?.user||''),root:saved?.root??autoRoot};this.cloud=null;this.queue=Promise.resolve();this.writeTokens=new Map();
    this.addSettingTab(new Settings(this));
    this.addCommand({id:'connect',name:'连接 Zotero 云端',callback:()=>new Connect(this).open()});
    this.addCommand({id:'link-annotation',name:'从 Zotero 批注新建 / 关联笔记',callback:()=>this.browse()});
    this.addRibbonIcon('link','知识桥：关联 Zotero 批注',()=>this.browse());
    this.registerObsidianProtocolHandler('knowledge-bridge-mobile',params=>{
      if(params.vault&&params.vault!==this.app.vault.getName()){new Notice('请先打开笔记库：'+params.vault);return;}
      // Navigation only: opening a URI never mutates notes or makes API writes.
      if(params.action==='open'){this.openLinked(params.user,params.annotation).catch(e=>new Notice(e.message,12000));return;}
      if(params.annotation)this.openAnnotation(params.annotation);else this.browse();
    });
  }
  onunload(){this.cloud=null;this.writeTokens.clear();}
  syncFiles(){return this.app.vault.getMarkdownFiles().filter(f=>!this.settings.root||f.path.startsWith(this.settings.root+'/'));}
  async openLinked(user,key){
    const tag=marker(user,{key}),matches=[];
    for(const f of this.syncFiles())if((await this.app.vault.cachedRead(f)).includes(tag))matches.push(f);
    if(matches.length!==1)throw Error(matches.length?'发现重复关联，请先整理笔记':'当前笔记库尚未找到关联，请打开正确的库并完成 Git Pull 后重试');
    await this.app.workspace.getLeaf(false).openFile(matches[0]);
  }
  async openAnnotation(k){
    if(!this.cloud){new Connect(this,()=>this.openAnnotation(k)).open();return;}
    try{new Associate(this,annotation(await this.cloud.item(k))).open();}catch(e){new Notice(e.message,12000);}
  }
  async browse(){
    if(!this.cloud){new Connect(this,()=>this.browse()).open();return;}
    try{
      const rows=await this.cloud.recent(),valid=[];
      for(const row of rows){try{valid.push(annotation(row));}catch{}}
      if(!valid.length){new Notice('最近 100 条批注中没有可用的 PDF 批注。请先在 Zotero 同步。');return;}
      new Pick(this.app,valid,a=>`第 ${a.page} 页 · ${a.quote.slice(0,160)} · ${a.key}`,a=>new Associate(this,a).open()).open();
    }catch(e){new Notice(e.message,12000);}
  }
  associate(a,title,target,reverse){
    // Serialize mutations even when two dialogs are open.
    const cloud=this.cloud;
    const task=this.queue.catch(()=>{}).then(()=>this.doAssociate(cloud,a,title,target,reverse));
    this.queue=task;return task;
  }
  async doAssociate(cloud,a,title,target,reverse){
    if(!cloud)throw Error('请先连接 Zotero');
    const vault=this.app.vault,tag=marker(cloud.user,a),matches=[];
    if(this.settings.root&&!vault.getAbstractFileByPath(this.settings.root))throw Error('同步子目录不存在，请检查知识桥手机扩展设置：'+this.settings.root);
    if(target&&this.settings.root&&!target.path.startsWith(this.settings.root+'/'))throw Error('所选笔记不在同步目录内');
    for(const f of this.syncFiles()){
      const text=await vault.cachedRead(f);
      if(text.includes(tag)||text.includes(']('+a.pdf+')'))matches.push(f);
    }
    if(matches.length>1)throw Error('多篇笔记包含该批注，请先合并或移除重复关联');
    let file=matches[0];
    if(file&&target&&file.path!==target.path)throw Error('该批注已关联：'+file.path+'。本次不会创建第二份关联。');
    if(!file&&target){
      if(!(target instanceof TFile)||vault.getAbstractFileByPath(target.path)!==target)throw Error('所选笔记已移动，请重新选择');
      await vault.process(target,text=>text.includes(tag)||text.includes(']('+a.pdf+')')?text:text+'\n\n'+block(cloud.user,a));file=target;
    }
    if(!file){
      title=title.trim()||('批注-'+a.key);
      if(/[\\/:*?"<>|\r\n]/.test(title)||title.length>100||title.endsWith('.')||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(title))throw Error('笔记名称无效');
      const folder=(this.settings.root?this.settings.root+'/':'')+'知识桥手机';
      if(!vault.getAbstractFileByPath(folder))await vault.createFolder(folder);
      let path=folder+'/'+title+'.md',n=1;
      while(vault.getAbstractFileByPath(path))path=folder+'/'+title+' '+n+++'.md';
      file=await vault.create(path,block(cloud.user,a));
    }
    // Carry identity inside the synced note; do not depend on device-specific paths.
    await vault.process(file,text=>text.includes(tag)?text:text+'\n\n'+tag+'\n');
    if(!reverse)return {file,ok:true,message:'已建立本地关联，可从笔记返回 Zotero PDF'};
    try{
      const id=tag+file.path;
      if(!this.writeTokens.has(id))this.writeTokens.set(id,globalThis.crypto.randomUUID().replace(/-/g,''));
      await cloud.backlink(a,vault.getName(),file.path,this.writeTokens.get(id));
      return {file,ok:true,message:'双向关联已建立；请在 Zotero 同步后打开父文献下的知识桥笔记'};
    }catch(e){return {file,ok:false,message:'本地关联已保存：'+file.path+'。Zotero 返回链接尚未确认：'+e.message+'。再次点击“建立关联”会复用本地笔记。'};}
  }
};
