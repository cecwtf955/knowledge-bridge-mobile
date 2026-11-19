'use strict';
const key = s => /^[23456789ABCDEFGHIJKLMNPQRSTUVWXYZ]{8}$/.test(s || '');
const html = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function annotation(data) {
  if (data.itemType !== 'annotation' || !key(data.key) || !key(data.parentItem)) throw Error('无效批注');
  let position;
  try { position = JSON.parse(data.annotationPosition); } catch { throw Error('批注缺少 PDF 定位信息'); }
  if (!Number.isInteger(position.pageIndex) || position.pageIndex < 0) throw Error('仅支持 PDF 批注');
  return {key:data.key, attachment:data.parentItem, page:position.pageIndex+1,
    quote:data.annotationText || data.annotationComment || '（图片或手写批注，请返回 PDF 查看）',
    pdf:`zotero://open-pdf/library/items/${data.parentItem}?page=${position.pageIndex+1}&annotation=${data.key}`};
}
function marker(user, a) {
  if (!/^\d+$/.test(user) || !key(a.key)) throw Error('无效关联标识');
  return `<!-- knowledge-bridge-mobile:${user}:${a.key} -->`;
}
function block(user, a) {
  return `${marker(user,a)}\n[返回 Zotero PDF 原句](${a.pdf})\n\n${a.quote.replace(/\r/g,'').split('\n').map(s=>'> '+s).join('\n')}\n\n`;
}
class Cloud {
  constructor(request, user, token) {
    if (!/^\d+$/.test(user)) throw Error('请填写 Zotero 数字用户 ID');
    if (!token) throw Error('请先连接 Zotero');
    this.request=request; this.user=user; this.token=token; this.until=0;
  }
  async call(path, method='GET', body, extra={}) {
    if (Date.now()<this.until) throw Error('Zotero 要求稍候，请过一分钟重试');
    let r;
    try { r=await this.request({url:'https://api.zotero.org'+path,method,throw:false,
      headers:{'Zotero-API-Version':'3','Zotero-API-Key':this.token,...(body?{'Content-Type':'application/json'}:{}),...extra},
      ...(body?{body:JSON.stringify(body)}:{})}); }
    catch { throw Error('无法连接 Zotero；请检查网络后重试。已有本地笔记会保留。'); }
    const h=Object.fromEntries(Object.entries(r.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
    const delay=Number(h.backoff||h['retry-after']||0);
    if(delay>0)this.until=Date.now()+delay*1000;
    if(r.status===429){this.until=Math.max(this.until,Date.now()+60000);throw Error('Zotero 请求过于频繁，请稍后重试');}
    if(r.status===401||r.status===403)throw Error('Zotero 密钥无效或权限不足；建立返回链接需要个人库写入权限');
    if(r.status<200||r.status>=300)throw Error('Zotero 请求未完成（HTTP '+r.status+'），可稍后重试');
    return r.json;
  }
  async list(suffix) {
    const out=[];
    for(let start=0;;start+=100){
      const rows=await this.call(`/users/${this.user}/${suffix}${suffix.includes('?')?'&':'?'}limit=100&start=${start}`);
      if(!Array.isArray(rows))throw Error('Zotero 返回格式异常');
      out.push(...rows); if(rows.length<100)return out;
    }
  }
  async item(k){if(!key(k))throw Error('无效条目标识');return (await this.call(`/users/${this.user}/items/${k}`)).data;}
  async recent(){return (await this.call(`/users/${this.user}/items?itemType=annotation&sort=dateModified&direction=desc&limit=100`)).map(r=>r.data);}
  async backlink(a, vault, file, writeToken){
    const attachment=await this.item(a.attachment);
    const parent=attachment.parentItem;
    if(!key(parent))throw Error('该 PDF 没有父文献条目；本地关联已保留，请先在 Zotero 给 PDF 建立父条目');
    const uri=`obsidian://knowledge-bridge-mobile?action=open&user=${this.user}&annotation=${a.key}`;
    const fallback=`obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(file)}`;
    const id=`KBM:${this.user}:${a.key}`;
    const notes=await this.list(`items/${parent}/children`);
    const existing=notes.find(n=>n.data.itemType==='note'&&(n.data.tags||[]).some(t=>t.tag===id)&&n.data.note.includes(html(uri)));
    if(existing)return existing.key;
    const template=await this.call('/items/new?itemType=note');
    const payload={...template,parentItem:parent,note:`<p>知识桥 · ${html(file)}</p><p><a href="${html(uri)}">打开 Obsidian 关联笔记</a></p><p><a href="${html(fallback)}">按创建时的路径打开（备用）</a></p><blockquote>${html(a.quote)}</blockquote><p><a href="${html(a.pdf)}">返回 PDF 批注</a></p>`,tags:[{tag:id}]};
    const result=await this.call(`/users/${this.user}/items`,'POST',[payload],{'Zotero-Write-Token':writeToken});
    if(result.failed?.['0'])throw Error('Zotero 返回链接写入失败：'+result.failed['0'].message);
    const saved=result.successful?.['0']?.key||result.unchanged?.['0'];
    if(!saved)throw Error('Zotero 未确认写入；请重试，插件会先检查是否已经存在');
    return saved;
  }
}
module.exports={Cloud,annotation,marker,block,html};
