const {TFile,MarkdownView,Notice}=require('obsidian');
const valid=id=>/^[a-f0-9-]{36}$/i.test(id||'');
const stamp=(id,side)=>`<!-- kbm-${side}:${id} -->`;
const uri=(id,side)=>`obsidian://knowledge-bridge-mobile?action=selection&id=${id}&side=${side}`;
const label=s=>s.replace(/\\/g,'\\\\').replace(/\[/g,'\\[').replace(/\]/g,'\\]');
module.exports={
  captureSource(editor,view){
    if(view?.getMode?.()==='preview'){
      const selection=view.containerEl.ownerDocument.defaultView.getSelection(),quote=selection?.toString()||'';
      if(!quote.trim()||!view.contentEl.contains(selection.anchorNode)||!view.contentEl.contains(selection.focusNode))throw Error('请先在当前笔记选中文字');
      const text=view.data||'',start=text.indexOf(quote);
      if(start<0||text.indexOf(quote,start+1)>=0)throw Error('阅读模式无法唯一定位此选区，请切换编辑模式重新选择');
      return {quote,id:globalThis.crypto.randomUUID(),origin:{file:view.file.path,start,end:start+quote.length,quote,text,view:null}};
    }
    if(!view?.file||!editor?.getSelection()?.trim())throw Error('请在 Obsidian 编辑模式选中原句，再点“新建 / 关联知识点”');
    const quote=editor.getSelection(),text=editor.getValue(),from=editor.getCursor('from'),to=editor.getCursor('to');
    if(quote.length>50000)throw Error('选区过长，请缩小到需要关联的段落');
    if(quote.includes('obsidian://knowledge-bridge-mobile'))throw Error('此选区已包含知识桥链接，请直接点击链接打开');
    return {quote,id:globalThis.crypto.randomUUID(),origin:{file:view.file.path,start:editor.posToOffset(from),end:editor.posToOffset(to),quote,text,view}};
  },
  async openSourceLink(id,side){
    if(!valid(id)||!['source','target'].includes(side))throw Error('无效知识点链接');
    const token=stamp(id,side),matches=[];
    for(const f of this.syncFiles())if((await this.app.vault.cachedRead(f)).includes(token))matches.push(f);
    if(matches.length!==1)throw Error(matches.length?'存在重复的关联笔记，请先整理':'未找到关联，请打开正确的笔记库并同步后重试');
    const file=matches[0],text=await this.app.vault.read(file),offset=text.indexOf(token),line=text.slice(0,offset).split('\n').length-1;
    await this.app.workspace.getLeaf(false).openFile(file,{eState:{line}});
  },
  associateSource(a,title,target,options){
    const task=this.queue.catch(()=>{}).then(()=>this.doAssociateSource(a,title,target,options));this.queue=task;return task;
  },
  async doAssociateSource(a,title,target,options){
    const vault=this.app.vault,o=a.origin,source=vault.getAbstractFileByPath(o.file);
    if(!(source instanceof TFile)||!this.syncFiles().includes(source))throw Error('原笔记不在同步目录内或已移动');
    if(target===source)throw Error('请选择原笔记以外的位置');
    const view=o.view?.file?.path===o.file&&o.view.editor?o.view:null;
    const current=view?view.editor.getValue():await vault.read(source);
    const existing=[];for(const f of this.syncFiles())if((await vault.cachedRead(f)).includes(stamp(a.id,'target')))existing.push(f);
    if(existing.length>1)throw Error('存在重复目标，请先整理');
    if(current.includes(stamp(a.id,'source'))&&existing.length===1)return {file:existing[0],ok:true,message:'已打开原有关联'};
    if(current!==o.text||current.slice(o.start,o.end)!==a.quote)throw Error('原笔记内容已变化，请关闭窗口后重新选中原句');
    const adapter=vault.adapter,backup=this.app.vault.configDir+'/plugins/'+this.manifest.id+'/source-backups';
    if(!await adapter.exists(backup))await adapter.mkdir(backup);
    if(!await adapter.exists(backup+'/'+a.id+'.md'))await adapter.write(backup+'/'+a.id+'.md',current);
    const content=stamp(a.id,'target')+'\n[返回 Obsidian 原句]('+uri(a.id,'source')+')\n\n'+a.quote.split('\n').map(s=>'> '+s).join('\n')+'\n\n';
    let file=existing[0];
    if(!file&&target){if(!this.syncFiles().includes(target))throw Error('目标笔记不在同步目录内');await vault.process(target,text=>text+'\n\n'+content);file=target;}
    if(!file)file=await this.createDestination(title,content,options);
    const replacement=stamp(a.id,'source')+a.quote.split('\n').map(s=>s?'==['+label(s)+']('+uri(a.id,'target')+')==':s).join('\n');
    // Recheck after asynchronous target/backup writes. Never replace an altered source.
    if(view){
      if(view.editor.getValue()!==current)throw Error('目标已保存，但原文刚刚改变。请恢复原选区内容后重试，或重新选择；目标不会被删除');
      view.editor.replaceRange(replacement,view.editor.offsetToPos(o.start),view.editor.offsetToPos(o.end));await view.save();
    }else await vault.process(source,text=>{if(text!==current)throw Error('目标已保存，但原文刚刚改变，请重新选择');return text.slice(0,o.start)+replacement+text.slice(o.end);});
    return {file,ok:true,message:'已建立原句与知识点的双向链接'};
  },
  installSelectionUI(){
    this.selectionBars=new Map();
    const launch=(editor,view)=>{try{this.showAssociate(this.captureSource(editor,view));}catch(e){new Notice(e.message);}};
    this.addCommand({id:'selection-create',name:'选中文字：新建 / 关联知识点',editorCallback:(editor,view)=>launch(editor,view)});
    this.registerEvent(this.app.workspace.on('editor-menu',(menu,editor,view)=>{if(!editor.getSelection()?.trim())return;menu.addItem(i=>i.setTitle('新建 / 关联知识点').setIcon('link').onClick(()=>launch(editor,view)));}));
    const refresh=()=>{
      if(this.disposed)return;
      const active=new Set();
      for(const leaf of this.app.workspace.getLeavesOfType('markdown')){
        const view=leaf.view;
        // Mobile can expose deferred/loading views during layout-ready. They are not editors yet.
        if(!view?.containerEl?.ownerDocument||!view?.contentEl?.before)continue;
        active.add(view);if(this.selectionBars.get(view)?.isConnected)continue;
        this.selectionBars.get(view)?.remove();
        const bar=view.containerEl.ownerDocument.createElement('div');bar.className='kbm-selection';
        const b=bar.createEl('button',{text:'选区 → 新建 / 关联'});
        let selected;
        b.onpointerdown=e=>{try{selected=this.captureSource(view.editor,view);}catch{selected=null;}e.preventDefault();};
        b.onclick=()=>{try{this.showAssociate(selected||this.captureSource(view.editor,view));selected=null;}catch(e){new Notice(e.message);}};
        const z=bar.createEl('button',{text:'Zotero 批注'});z.onclick=()=>this.browse();
        view.contentEl.before(bar);this.selectionBars.set(view,bar);
      }
      for(const [view,bar] of this.selectionBars)if(!active.has(view)){bar.remove();this.selectionBars.delete(view);}
    };
    const safeRefresh=()=>{try{refresh();}catch(e){
      const message='选区工具栏：'+String(e.message||e);
      this.startupWarnings ||= [];
      if(!this.startupWarnings.includes(message)){this.startupWarnings.push(message);new Notice('知识桥工具栏暂未就绪；可用命令“选中文字：新建 / 关联知识点”。诊断见插件设置。',12000);}
    }};
    this.registerEvent(this.app.workspace.on('layout-change',safeRefresh));
    this.registerEvent(this.app.workspace.on('active-leaf-change',safeRefresh));
    this.registerEvent(this.app.workspace.on('file-open',safeRefresh));
    this.app.workspace.onLayoutReady(safeRefresh);
  }
};
