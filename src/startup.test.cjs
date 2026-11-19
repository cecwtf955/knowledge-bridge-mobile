const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function load({views=[],saved={root:'notes'},exists=async()=>true,layoutError=false}={}){
 const commands=[],warnings=[],events={};
 class Plugin{async loadData(){return saved;}addSettingTab(){}addCommand(c){commands.push(c.id);}addRibbonIcon(){}registerEvent(){}registerObsidianProtocolHandler(){}}
 const obsidian={Plugin,PluginSettingTab:class{},Modal:class{},Setting:class{},FuzzySuggestModal:class{},TFile:class{},TFolder:class{},MarkdownView:class{},Platform:{isMobileApp:true},Notice:class{constructor(t){warnings.push(t);}}};
 const box={module:{exports:{}},require:n=>{assert.equal(n,'obsidian');return obsidian;}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../main.js','utf8'),box);
 const p=new box.module.exports();p.app={vault:{adapter:{exists}},workspace:{on:(n,fn)=>{events[n]=fn;return {};},onLayoutReady:fn=>fn(),getLeavesOfType:()=>{if(layoutError)throw Error('layout pending');return views;}}};
 return {p,commands,warnings,events};
}
test('bundled plugin starts with mobile deferred view',async()=>{const {p,commands}=load({views:[{view:{}}]});await p.onload();assert(commands.includes('selection-create'));assert(commands.includes('connect'));assert(commands.includes('link-annotation'));p.onunload();});
test('bundled plugin starts with no open note',async()=>{const {p}=load();await p.onload();p.onunload();});
test('optional toolbar failure does not disable plugin and is diagnosable',async()=>{const {p,commands}=load({layoutError:true});await p.onload();assert.equal(commands.length,3);assert(p.startupWarnings[0].includes('layout pending'));});
test('saved sync root does not probe mobile hidden git directory',async()=>{const {p}=load({exists:async()=>{throw Error('must not probe');}});await p.onload();assert.equal(p.settings.root,'notes');assert.equal(p.startupWarnings.length,0);});
test('hidden directory probe failure keeps first startup available',async()=>{const {p}=load({saved:null,exists:async()=>{throw Error('not accessible');}});await p.onload();assert.equal(p.settings.root,'');assert(p.startupWarnings.length);});
test('layout events after unload do not recreate toolbar',async()=>{const {p,events}=load();await p.onload();p.onunload();events['file-open']();assert.equal(p.selectionBars.size,0);});
