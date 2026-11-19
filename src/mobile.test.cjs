const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const core=require('./core');
const data={itemType:'annotation',key:'ABCDEFGH',parentItem:'JKLMNPQR',annotationPosition:'{"pageIndex":2}',annotationText:'hello\nworld'};
const a=core.annotation(data);
class TFile {constructor(path){this.path=path;}}
class TFolder {}
const mock={TFolder,Plugin:class{},PluginSettingTab:class{},Modal:class{},Setting:class{},FuzzySuggestModal:class{},Notice:class{},TFile};
const sandbox={module:{exports:{}},require:n=>n==='obsidian'?mock:n==='./core'?core:n==='./chooser'?class {}:(()=>{throw Error('Desktop dependency: '+n)})(),globalThis:{crypto:require('node:crypto').webcrypto}};
vm.runInNewContext(fs.readFileSync(__dirname+'/main.js','utf8'),sandbox);
const Mobile=sandbox.module.exports;
const selectionBox={module:{exports:{}},require:n=>mock,globalThis:{crypto:require('node:crypto').webcrypto}};vm.runInNewContext(fs.readFileSync(__dirname+'/selection.js','utf8'),selectionBox);const selection=selectionBox.module.exports;
function instance(){
 const p=new Mobile();Object.assign(p,selection);const files=new Map(),contents=new Map();
 const vault={getMarkdownFiles:()=>[...files.values()].filter(f=>f instanceof TFile),getAbstractFileByPath:k=>files.get(k),cachedRead:async f=>contents.get(f.path),
 read:async f=>contents.get(f.path),getName:()=> '我的笔记',createFolder:async k=>files.set(k,{}),
 create:async(k,s)=>{assert(!files.has(k));const f=new TFile(k);files.set(k,f);contents.set(k,s);return f;},
 process:async(f,cb)=>contents.set(f.path,cb(contents.get(f.path)))};
 p.app={vault};p.settings={root:''};p.queue=Promise.resolve();p.writeTokens=new Map();p.cloud={user:'123',backlink:async()=> 'STUVWXYZ'};
 return {p,vault,contents};
}
test('PDF page index and backlink match desktop format',()=>assert.equal(a.pdf,'zotero://open-pdf/library/items/JKLMNPQR?page=3&annotation=ABCDEFGH'));
test('unsupported non PDF positions rejected',()=>assert.throws(()=>core.annotation({...data,annotationPosition:'{}'})));
test('bad key and path injection rejected',()=>assert.throws(()=>core.annotation({...data,parentItem:'../../hi'})));
test('quote cannot break out of markdown blockquote',()=>assert(core.block('123',a).includes('> hello\n> world')));
test('cloud requests authenticated over HTTPS',async()=>{
 const c=new core.Cloud(async r=>{assert(r.url.startsWith('https://api.zotero.org/users/123/'));assert.equal(r.headers['Zotero-API-Key'],'secret');return {status:200,json:[]};},'123','secret');await c.recent();
});
test('pagination reads beyond first 100 children',async()=>{
 let calls=0;const c=new core.Cloud(async()=>({status:200,json:++calls===1?Array(100).fill({}):[{}]}),'123','x');assert.equal((await c.list('items/ABCDEFGH/children')).length,101);
});
test('403 is not reported as success',async()=>{const c=new core.Cloud(async()=>({status:403}),'123','x');await assert.rejects(c.recent(),/权限/);});
test('rate limit blocks immediate repeat request',async()=>{let calls=0;const c=new core.Cloud(async()=>{calls++;return {status:429};},'123','x');await assert.rejects(c.recent());await assert.rejects(c.recent());assert.equal(calls,1);});
test('duplicate clicks reuse one local note',async()=>{const {p,vault}=instance();await Promise.all([p.associate(a,'test',null,false),p.associate(a,'test',null,false)]);assert.equal(vault.getMarkdownFiles().length,1);});
test('desktop-created backlink is recognized without links.json',async()=>{const {p,vault}=instance();const f=await vault.create('旧笔记.md','[返回 Zotero PDF 原句]('+a.pdf+')');assert.equal((await p.associate(a,'new',null,false)).file,f);assert.equal(vault.getMarkdownFiles().length,1);});
test('existing text preserved on bind and retry',async()=>{const {p,vault,contents}=instance();const f=await vault.create('existing.md','my ideas');await p.associate(a,'',f,false);await p.associate(a,'',f,false);const body=contents.get(f.path);assert(body.startsWith('my ideas'));assert.equal(body.split(core.marker('123',a)).length,2);});
test('cloud failure keeps note and retries without duplication',async()=>{const {p,vault}=instance();p.cloud.backlink=async()=>{throw Error('offline');};const result=await p.associate(a,'test',null,true);assert.equal(result.ok,false);await p.associate(a,'test',null,true);assert.equal(vault.getMarkdownFiles().length,1);});
test('conflicting existing notes stop mutation',async()=>{const {p,vault}=instance();await vault.create('one.md',core.block('123',a));await vault.create('two.md',core.block('123',a));await assert.rejects(p.associate(a,'new',null,false),/多篇/);assert.equal(vault.getMarkdownFiles().length,2);});
test('cannot associate same annotation to a second target silently',async()=>{const {p,vault}=instance();await p.associate(a,'first',null,false);const f=await vault.create('second.md','untouched');await assert.rejects(p.associate(a,'',f,false),/已关联/);});
test('new note name rejects traversal',async()=>{const {p}=instance();await assert.rejects(p.associate(a,'../outside',null,false),/无效/);});
test('iPhone nested Git repo receives new notes',async()=>{const {p,vault}=instance();p.settings.root='notes';await vault.createFolder('notes');const r=await p.associate(a,'test',null,false);assert.equal(r.file.path,'notes/知识桥手机/test.md');});
test('missing sync root never falls back to unsynced root',async()=>{const {p,vault}=instance();p.settings.root='notes';await assert.rejects(p.associate(a,'test',null,false),/不存在/);assert.equal(vault.getMarkdownFiles().length,0);});
test('target outside nested sync repo rejected',async()=>{const {p,vault}=instance();p.settings.root='notes';await vault.createFolder('notes');const f=await vault.create('outside.md','text');await assert.rejects(p.associate(a,'',f,false),/不在同步目录/);});
test('cloud reverse link escapes HTML and encodes file name',async()=>{
 let payload;const c=new core.Cloud(async r=>{
 if(r.method==='POST'){payload=JSON.parse(r.body)[0];return {status:200,json:{successful:{0:{key:'STUVWXYZ'}}}};}
 if(r.url.includes('/children'))return {status:200,json:[]};
 if(r.url.includes('/items/new'))return {status:200,json:{itemType:'note',note:'',tags:[]}};
 return {status:200,json:{data:{parentItem:'STUVWXYZ'}}};
 },'123','x');
 await c.backlink({...a,quote:'<img src=x>'},'my vault','目录/a & b.md','a'.repeat(32));
 assert(payload.note.includes('&lt;img'));assert(!payload.note.includes('<img'));assert(payload.note.includes('my%20vault'));assert(payload.note.includes('&amp;file='));assert.equal(payload.parentItem,'STUVWXYZ');
});
test('HTTP 200 partial write failure is still failure',async()=>{
 const c=new core.Cloud(async r=>({status:200,json:r.method==='POST'?{failed:{0:{message:'denied'}}}:r.url.includes('/children')?[]:r.url.includes('/items/new')?{itemType:'note'}:{data:{parentItem:'STUVWXYZ'}}}),'123','x');await assert.rejects(c.backlink(a,'v','f','a'.repeat(32)),/denied/);
});
test('existing Zotero return note avoids duplicate write',async()=>{
 const c=new core.Cloud(async r=>{assert.equal(r.method,'GET');return {status:200,json:r.url.includes('/children')?[{key:'STUVWXYZ',data:{itemType:'note',tags:[{tag:'KBM:123:ABCDEFGH'}],note:'obsidian://knowledge-bridge-mobile?action=open&amp;user=123&amp;annotation=ABCDEFGH'}}]:{data:{parentItem:'STUVWXYZ'}}};},'123','x');assert.equal(await c.backlink(a,'v','f','a'.repeat(32)),'STUVWXYZ');
});
test('stable return link resolves without cloud or original file path',async()=>{const {p,vault}=instance();const f=await vault.create('renamed.md',core.block('123',a));let opened;p.cloud=null;p.app.workspace={getLeaf:()=>({openFile:async file=>opened=file})};await p.openLinked('123',a.key);assert.equal(opened,f);});
test('stable return link respects account identity',async()=>{const {p,vault}=instance();await vault.create('other.md',core.block('456',a));await assert.rejects(p.openLinked('123',a.key),/尚未找到/);});
test('stable return link rejects ambiguous copies',async()=>{const {p,vault}=instance();await vault.create('one.md',core.block('123',a));await vault.create('two.md',core.block('123',a));await assert.rejects(p.openLinked('123',a.key),/重复/);});
test('folder mode creates default note at chosen nested location',async()=>{const {p,vault}=instance();p.settings.root='notes';await vault.createFolder('notes');await vault.createFolder('notes/Research');const r=await p.associate(a,'Idea',null,false,{folder:'notes/Research',kind:'folder'});assert.equal(r.file.path,'notes/Research/Idea/默认.md');});
test('chosen root does not silently use legacy default folder',async()=>{const {p}=instance();const r=await p.associate(a,'Idea',null,false,{folder:'',kind:'note'});assert.equal(r.file.path,'Idea.md');});
test('chosen missing directory fails before creating note',async()=>{const {p,vault}=instance();await assert.rejects(p.associate(a,'Idea',null,false,{folder:'missing',kind:'note'}),/已移动/);assert.equal(vault.getMarkdownFiles().length,0);});
async function sourceFixture(){
 const f=instance(),{p,vault}=f;const source=await vault.create('source.md','first alpha and second alpha');const backups=new Map();
 vault.configDir='.obsidian';vault.adapter={exists:async path=>backups.has(path),mkdir:async path=>backups.set(path,''),write:async(path,s)=>backups.set(path,s)};p.manifest={id:'knowledge-bridge-mobile'};
 const request={id:'12345678-1234-1234-1234-123456789abc',quote:'alpha',origin:{file:source.path,start:23,end:28,quote:'alpha',text:'first alpha and second alpha'}};
 return {...f,source,request,backups};
}
test('Obsidian selection links exact second occurrence with backup',async()=>{const {p,contents,request,backups}=await sourceFixture();const r=await p.associateSource(request,'target',null,{folder:'',kind:'note'});assert(r.ok);assert(contents.get('source.md').startsWith('first alpha and second <!-- kbm-source:'));assert(contents.get(r.file.path).includes('返回 Obsidian 原句'));assert([...backups.values()].includes(request.origin.text));});
test('Obsidian folder flow and repeat reuses linked target',async()=>{const {p,vault,request}=await sourceFixture();const r=await p.associateSource(request,'Folder',null,{folder:'',kind:'folder'});const again=await p.associateSource(request,'Folder',null,{folder:'',kind:'folder'});assert.equal(r.file.path,'Folder/默认.md');assert.equal(again.file,r.file);assert.equal(vault.getMarkdownFiles().length,2);});
test('changed source refuses mutation before creating target',async()=>{const {p,vault,contents,request}=await sourceFixture();contents.set('source.md','edited');await assert.rejects(p.associateSource(request,'target',null,{folder:'',kind:'note'}),/已变化/);assert.equal(vault.getMarkdownFiles().length,1);});
test('existing target content preserved in Obsidian selection flow',async()=>{const {p,vault,contents,request}=await sourceFixture();const target=await vault.create('target.md','keep me');await p.associateSource(request,'',target,{folder:'',kind:'note'});assert(contents.get('target.md').startsWith('keep me'));});
test('self association rejected',async()=>{const {p,source,request}=await sourceFixture();await assert.rejects(p.associateSource(request,'',source,{folder:'',kind:'note'}),/以外/);});
