#!/usr/bin/env python3
"""Read a pinned Git tree into a file graph. No repository code is executed.

This is a deliberately bounded structural extractor, not a call-graph engine.
JS literal imports use a small lexer; documentation paths remain textual mentions.
"""
import argparse
from bisect import bisect_right
from collections import Counter
import hashlib
import json
from pathlib import Path, PurePosixPath
import posixpath
import re
import subprocess
from urllib.parse import unquote, urlsplit

CODE = set('ts tsx mts cts js jsx mjs cjs svelte astro py rs go c h cpp hpp java scala dart swift rb php sh ps1 sql css scss html'.split())
CONFIG = set('json jsonc yaml yml toml lock ini cfg conf'.split())
IMPORT_EXTS = ('.ts','.tsx','.mts','.cts','.js','.jsx','.mjs','.cjs','.json','.svelte','.astro')
SCAN_LIMIT = 2_000_000
WORD = re.compile(r'[A-Za-z_$][\w$]*')

def git(repo,*args):
    return subprocess.check_output(['git','--git-dir='+str(repo),*args])

def read_blobs(repo, entries):
    # Keep one Git process, but only one blob's bytes in memory at a time.
    with subprocess.Popen(['git','--git-dir='+str(repo),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE) as proc:
        for entry in entries:
            proc.stdin.write((entry['oid']+'\n').encode());proc.stdin.flush()
            header=proc.stdout.readline().split()
            if len(header)!=3 or header[0].decode()!=entry['oid'] or header[1]!=b'blob':
                raise ValueError('unexpected Git blob response: '+entry['path'])
            size=int(header[2]);data=proc.stdout.read(size)
            if len(data)!=size or proc.stdout.read(1)!=b'\n':raise ValueError('incomplete Git blob: '+entry['path'])
            yield entry,data
        proc.stdin.close()
        if proc.wait():raise subprocess.CalledProcessError(proc.returncode,proc.args)

def kind(path):
    name=PurePosixPath(path).name
    if name=='SKILL.md':return 'skill'
    if name in ('AGENTS.md','CLAUDE.md') or name.endswith('.mdc'):return 'instruction'
    ext=name.rsplit('.',1)[-1].lower()
    if ext in ('md','mdx','rst','txt') or name in ('LICENSE','NOTICE'):return 'document'
    if ext in CONFIG or name.startswith('.'):return 'config'
    if ext in CODE:return 'code'
    return 'asset'

def js_tokens(text):
    """Lex tokens without treating comments or quoted example code as imports.

    Template bodies and regex literals are skipped. This intentionally does not
    claim compiler/type resolution, nor evaluation of generated module names.
    """
    out=[];i=0;n=len(text);prev=''
    while i<n:
        c=text[i]
        if c.isspace():i+=1;continue
        if text.startswith('//',i):
            end=text.find('\n',i);i=n if end<0 else end;continue
        if text.startswith('/*',i):
            end=text.find('*/',i+2);i=n if end<0 else end+2;continue
        if c in "'\"`":
            quote=c;start=i;i+=1;value=''
            while i<n:
                if text[i]=='\\':
                    value+=text[i:i+2];i+=2;continue
                if text[i]==quote:i+=1;break
                value+=text[i];i+=1
            out.append(('string' if quote!='`' else 'template',value,start));prev='literal';continue
        if c=='/' and prev in ('','=','(',':',',','return','[','!','?',';','{','=>'):
            start=i;i+=1;inside=False
            while i<n and text[i]!='\n':
                if text[i]=='\\':i+=2;continue
                if text[i]=='[':inside=True
                if text[i]==']':inside=False
                if text[i]=='/' and not inside:
                    i+=1
                    while i<n and text[i].isalpha():i+=1
                    break
                i+=1
            out.append(('regex','',start));prev='literal';continue
        match=WORD.match(text,i)
        if match:
            value=match.group();out.append(('word',value,i));i+=len(value);prev=value;continue
        out.append(('punct',c,i));prev=c;i+=1
    return out

def imports(text):
    tokens=js_tokens(text)
    for i,(typ,value,start) in enumerate(tokens):
        if typ!='word' or value not in ('import','export','require'):continue
        if i and tokens[i-1][1] in ('.','?.'):continue
        rest=tokens[i+1:i+100]
        if not rest:continue
        if value in ('import','require') and rest[0][1]=='(':
            if len(rest)>2 and rest[1][0]=='string' and rest[2][1]==')':
                yield rest[1][1],rest[1][2], 'literal-import'
            continue
        if value=='require':continue
        if value=='import' and rest[0][0]=='string':
            yield rest[0][1],rest[0][2],'literal-import';continue
        for j,t in enumerate(rest[:-1]):
            if t[1]==';' or (t[1] in ('import','export') and j>0):break
            if t[1]=='from' and rest[j+1][0]=='string':
                yield rest[j+1][1],rest[j+1][2],'literal-import';break

def build_graph(repo,revision,repo_name):
    if not re.fullmatch(r'[\w.-]+/[\w.-]+',repo_name):raise ValueError('invalid GitHub name')
    sha=git(repo,'rev-parse','--verify',revision+'^{commit}').decode().strip()
    entries=[]
    for rec in git(repo,'ls-tree','-rlz',sha).decode().split('\0'):
        if not rec:continue
        meta,path=rec.split('\t',1);mode,typ,oid,size=meta.split()
        entries.append(dict(id=path,path=path,mode=mode,oid=oid,bytes=int(size) if size.isdigit() else 0,
                            kind=kind(path),git_type=typ,parent=posixpath.dirname(path) or '/'))
    nodes={e['id']:e for e in entries};directories={'/'}
    for e in entries:
        parent=e['parent']
        while parent!='/':directories.add(parent);parent=posixpath.dirname(parent) or '/'
    for d in directories:
        nodes[d]=dict(id=d,path=d,kind='directory',parent=(posixpath.dirname(d) or '/') if d!='/' else None)
    # One cat-file process reads immutable blobs; symlinks are recorded, never followed.
    blobs=[e for e in entries if e['git_type']=='blob' and e['bytes']<=SCAN_LIMIT]
    texts={};coverage=Counter();unresolved=[];edges={};external=Counter();discarded=Counter()
    for e,data in read_blobs(repo,blobs):
        if e['mode'] not in ('100644','100755'):
            e['scan']='not-regular';coverage['not-regular']+=1;continue
        try:
            if b'\0' in data:raise UnicodeError()
            text=data.decode('utf-8')
        except UnicodeError:e['scan']='binary';coverage['binary']+=1;continue
        texts[e['id']]=text;e['text_file']='content/'+e['oid']+'.txt';e['lines']=len(text.splitlines())
        ext=PurePosixPath(e['id']).suffix.lower()
        e['scan']='imports' if ext in ('.ts','.tsx','.mts','.cts','.js','.jsx','.mjs','.cjs','.svelte','.astro') else 'text-paths' if e['kind'] in ('document','instruction','skill','config') else 'inventory-only'
        coverage[e['scan']]+=1
        e['outline']=[dict(title=m.group(2).strip().rstrip('#').strip(),line=text.count('\n',0,m.start())+1,level=len(m.group(1))) for m in re.finditer(r'^(#{1,6})\s+(.+)$',text,re.M)][:100] if e['kind'] in ('document','instruction','skill') else []
    for e in entries:
        if 'scan' not in e:e['scan']='too-large' if e['bytes']>SCAN_LIMIT else 'not-blob';coverage[e['scan']]+=1

    def resolve(source,spec,relation):
        if any(c in spec for c in ('*','{','}','<','>','\\')):return None,'pattern-or-escaped'
        target=unquote(spec.split('#',1)[0].split('?',1)[0])
        if not target:return None,'fragment-only'
        if urlsplit(target).scheme or target.startswith('//'):return None,'external'
        parent=posixpath.dirname(source)
        if relation=='literal-import':
            if not target.startswith('.'):return None,'package-or-alias'
            base=posixpath.normpath(posixpath.join(parent,target));candidates=[base]
            if PurePosixPath(base).suffix in ('.js','.mjs','.cjs'):
                candidates += [posixpath.splitext(base)[0]+x for x in ('.ts','.tsx','.mts','.cts')]
            if not PurePosixPath(base).suffix:candidates += [base+x for x in IMPORT_EXTS]
            candidates += [posixpath.join(base,'index'+x) for x in IMPORT_EXTS]
            matches=[x for x in candidates if x in nodes and nodes[x]['kind']!='directory']
            return (matches[0],'resolved') if len(set(matches))==1 else (None,'ambiguous' if matches else 'not-in-tree')
        roots=[posixpath.normpath(posixpath.join(parent,target))]
        if not target.startswith('.'):roots.append(posixpath.normpath(target.lstrip('/')))
        matches=set(x for x in roots if x in nodes)
        return (next(iter(matches)),'resolved') if len(matches)==1 else (None,'ambiguous' if matches else 'not-in-tree')

    def add(source,spec,offset,relation):
        target,status=resolve(source,spec,relation)
        line=bisect_right(breaks,offset)+1;snippet=lines[line-1][:700]
        if status in ('external','package-or-alias'):
            external[status]+=1;return
        if not target:
            # Slash-separated prose such as "with/without" is not a useful
            # missing-path report. Keep unresolved path-shaped candidates only.
            path_like=(spec.startswith(('./','../','/')) or spec.split('/')[0] in nodes or PurePosixPath(spec).suffix.lstrip('.').lower() in CODE|CONFIG|{'md','rst','txt','mdx'})
            if relation=='path-mention' and not path_like:discarded['nonpath-text']+=1;return
            if status!='fragment-only':unresolved.append(dict(source=source,spec=spec,line=line,kind=relation,reason=status,snippet=snippet))
            return
        if target==source:return
        key=(source,target,relation)
        edge=edges.setdefault(key,dict(id='e-'+hashlib.sha256('\0'.join(key).encode()).hexdigest()[:16],source=source,target=target,kind=relation,evidence=[]))
        evidence=dict(line=line,spec=spec,snippet=snippet)
        if evidence not in edge['evidence']:edge['evidence'].append(evidence)

    for source,text in texts.items():
        node=nodes[source]
        if node['scan'] not in ('imports','text-paths'):continue
        breaks=[m.start() for m in re.finditer('\n',text)];lines=text.splitlines()
        if node['scan']=='imports':
            source_text=text
            if source.endswith(('.svelte','.astro')):
                # Preserve offsets while limiting extraction to actual script/frontmatter regions.
                chars=['\n' if c=='\n' else ' ' for c in text]
                regions=list(re.finditer(r'<script\b[^>]*>([\s\S]*?)</script\s*>',text,re.I))
                if source.endswith('.astro'):
                    regions+=list(re.finditer(r'\A---[^\n]*\n([\s\S]*?)\n---',text))
                for m in regions:chars[m.start(1):m.end(1)]=text[m.start(1):m.end(1)]
                source_text=''.join(chars)
            for spec,offset,rel in imports(source_text):add(source,spec,offset,rel)
        elif node['scan']=='text-paths':
            spans=[]
            if node['kind']!='config':
                # Inline/image links and reference definitions. This is a bounded
                # Markdown recognizer, not a full Markdown renderer.
                for m in re.finditer(r'\]\(\s*<?([^\s)>]+)>?(?:\s+["\'][^\n]*?["\'])?\s*\)|^\s*\[[^\]]+\]:\s*<?([^\s>]+)',text,re.M):
                    group=1 if m.group(1) is not None else 2
                    add(source,m.group(group),m.start(group),'document-link');spans.append((m.start(),m.end()))
            # Exact path-like tokens, including code examples in skill instructions.
            # Presence is a mention, never proof that a command is executed.
            for m in re.finditer(r'(?<![\w./:@-])(?:\.{1,2}/)?[\w.@-]+(?:/[\w.@-]+)+/?|(?<![\w./:@-])[\w.-]+\.(?:md|json|ya?ml|toml|ts|mjs|sh)(?![\w./-])',text):
                if any(a<=m.start()<b for a,b in spans):continue
                spec=m.group()
                if '/' in spec and text[max(0,m.start()-8):m.start()].endswith(('https://','http://')):continue
                add(source,spec,m.start(),'path-mention')
    child=Counter(n['parent'] for n in nodes.values() if n['parent'] is not None)
    directory_kinds={d:Counter() for d in directories}
    for e in entries:
        parent=e['parent']
        while True:
            directory_kinds[parent][e['kind']]+=1
            if parent=='/':break
            parent=posixpath.dirname(parent) or '/'
    for d in directories:
        nodes[d].update(count=sum(directory_kinds[d].values()),children=child[d],kinds=dict(directory_kinds[d]))
    outgoing=Counter(x['source'] for x in edges.values());incoming=Counter(x['target'] for x in edges.values())
    for e in entries:
        e['outgoing']=outgoing[e['id']];e['incoming']=incoming[e['id']]
    result=dict(schema=1,repo=repo_name,revision=sha,nodes=sorted(nodes.values(),key=lambda n:n['id']),edges=sorted(edges.values(),key=lambda e:e['id']),
                unresolved=unresolved,summary=dict(files=len(entries),directories=len(directories)-1,relations=len(edges),kinds=dict(Counter(e['kind'] for e in entries)),
                scans=dict(coverage),external=dict(external),unresolved=len(unresolved),discarded_candidates=dict(discarded)),
                limits=['文件是本轮基本单元，目录仅按Git路径分组；未提取函数调用图或解释语义职责。',
                        '导入关系仅扫描JS/TS字面量及Svelte/Astro脚本区域；未做完整编译解析，包名、别名、计算表达式和其他语言依赖不在已解析范围。',
                        '文档链接使用有限Markdown规则；文字与配置中的路径是精确文本提及，不证明执行、依赖或意图。代码示例中的路径也计为提及。',
                        '目标必须存在于当前Git树。相对与根路径冲突、未找到的目标单列；没有连线不表示没有关联。',
                        '非UTF-8、二进制、非普通文件及超过2MB的文件仅记录结构；不执行仓库脚本、skill或指令。'])
    return result,texts

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repo',type=Path,required=True);p.add_argument('--revision',required=True);p.add_argument('--name',required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--ui',type=Path)
    a=p.parse_args();graph,texts=build_graph(a.repo,a.revision,a.name);a.out.mkdir(parents=True,exist_ok=True);(a.out/'content').mkdir(exist_ok=True)
    (a.out/'data.json').write_text(json.dumps(graph,ensure_ascii=False,separators=(',',':'))+'\n')
    for n in graph['nodes']:
        if n.get('text_file'):(a.out/n['text_file']).write_text(texts[n['id']],encoding='utf-8')
    if a.ui:
        template=(a.ui/'atlas.html').read_text();css=(a.ui/'atlas.css').read_text();js=(a.ui/'atlas.js').read_text()
        (a.out/'index.html').write_text(template.replace('__ATLAS_STYLE__',css).replace('__ATLAS_SCRIPT__',js))
    print(json.dumps(graph['summary'],ensure_ascii=False))

if __name__=='__main__':main()
