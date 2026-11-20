const {Modal,Setting,TFile,TFolder,Notice}=require('obsidian');
class Associate extends Modal {
  constructor(p,a){super(p.app);this.p=p;this.a=a;this.title='';this.mode='note';this.folder=p.settings.root||'';this.target=null;this.reverse=!a.origin;this.busy=false;}
  onOpen(){
    this.titleEl.setText('新建 / 关联知识点');
    this.contentEl.addClass('kbm-chooser');
    this.contentEl.createEl('blockquote',{text:this.a.quote});
    if(!this.a.origin)this.contentEl.createEl('p',{text:'Zotero · 第 '+this.a.page+' 页'});
    this.modeEl=this.contentEl.createDiv({cls:'kbm-modes'});
    this.modeButtons=[];
    for(const [mode,label] of [['note','新建笔记'],['folder','新建文件夹'],['existing','关联已有笔记']]){
      const b=this.modeEl.createEl('button',{text:label});this.modeButtons.push([mode,b]);
      b.onclick=()=>{if(this.busy)return;this.mode=mode;this.target=null;this.render();};
    }
    this.nameSetting=new Setting(this.contentEl).setName('名称').addText(t=>{this.nameInput=t;t.setPlaceholder('输入名称').onChange(v=>this.title=v);});
    this.browser=this.contentEl.createDiv({cls:'kbm-browser'});
    if(!this.a.origin)new Setting(this.contentEl).setName('在 Zotero 添加返回链接').addToggle(t=>t.setValue(true).onChange(v=>this.reverse=v));
    this.status=this.contentEl.createEl('p',{attr:{role:'status','aria-live':'polite'}});
    this.submit=this.contentEl.createEl('button',{text:'创建并打开',cls:'mod-cta kbm-submit'});
    this.submit.onclick=()=>this.run();this.render();
  }
  render(){
    for(const [mode,b] of this.modeButtons){b.classList.toggle('mod-cta',mode===this.mode);b.setAttribute('aria-pressed',String(mode===this.mode));b.disabled=this.busy;}
    this.nameSetting.settingEl.style.display=this.mode==='existing'?'none':'';
    this.browser.empty();
    const root=this.p.settings.root||'',current=this.folder?this.app.vault.getAbstractFileByPath(this.folder):this.app.vault.getRoot();
    const relative=this.folder.slice(root.length).replace(/^\//,'');
    this.browser.createEl('p',{text:'当前位置：'+(relative||'同步仓库根目录'),cls:'kbm-location'});
    const up=this.browser.createEl('button',{text:'↑ 上一级'});up.disabled=this.folder===root||this.busy;
    up.onclick=()=>{this.folder=this.folder.includes('/')?this.folder.slice(0,this.folder.lastIndexOf('/')):'';if(root&&!this.folder.startsWith(root))this.folder=root;this.target=null;this.render();};
    const list=this.browser.createDiv({cls:'kbm-entries'});
    if(!current||(!Array.isArray(current.children))){list.createEl('p',{text:'此文件夹不存在，请检查同步仓库子目录设置。'});}
    else{
      const children=[...current.children].filter(f=>f instanceof TFolder || (this.mode==='existing'&&f instanceof TFile&&f.extension==='md')).sort((a,b)=>(a instanceof TFolder?0:1)-(b instanceof TFolder?0:1)||a.name.localeCompare(b.name,'zh-CN'));
      for(const child of children){
        if(child.name.startsWith('.'))continue;
        const folder=child instanceof TFolder;
        const b=list.createEl('button',{text:(folder?'📁 ':'📄 ')+child.name+(folder?'  ›':''),cls:'kbm-entry'});b.disabled=this.busy;
        if(this.target===child)b.classList.add('mod-cta');
        b.onclick=()=>{if(folder){this.folder=child.path;this.target=null;}else this.target=child;this.render();};
      }
      if(!children.length)list.createEl('p',{text:this.mode==='existing'?'此处没有子文件夹或 Markdown 笔记':'此处没有子文件夹，可直接在这里创建'});
    }
    this.submit.textContent=this.busy?'正在建立关联…':this.mode==='existing'?'关联并打开':this.mode==='folder'?'创建文件夹并打开':'创建笔记并打开';
    this.submit.disabled=this.busy||(this.mode==='existing'&&!this.target);
    this.status.setText(this.mode==='existing'?(this.target?'已选择：'+this.target.name:'逐层进入文件夹，再点选目标笔记'):(this.mode==='folder'?'在当前位置新建文件夹，内部创建“默认.md”作为关联入口':'在当前位置新建笔记'));
  }
  async run(){
    if(this.busy)return;this.busy=true;this.render();
    try{
      let opened=false;
      const openSaved=async file=>{
        await this.p.openVisible(file);opened=true;this.close();
        new Notice('已打开：'+file.path+(this.reverse?'\n正在添加 Zotero 返回链接…':''),10000);
      };
      const options={folder:this.folder,kind:this.mode==='folder'?'folder':'note',onLocalSaved:openSaved};
      const result=this.a.origin?await this.p.associateSource(this.a,this.title,this.target,options):await this.p.associate(this.a,this.title,this.target,this.reverse,options);
      if(result.file){if(!opened)await openSaved(result.file);new Notice(result.message,result.ok?10000:30000);}
      else {this.busy=false;this.render();this.status.setText(result.message);}
    }catch(e){this.busy=false;this.render();this.status.setText(e.message);}
  }
  onClose(){this.contentEl.empty();}
}
module.exports=Associate;
