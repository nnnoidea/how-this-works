# 当前项目命令

需要Python >=3.9、Git和Node >=22.18。整个 `how-this-works` 目录即为可复制安装的 skill；`skill_dir` 指向安装后的实际目录。首次安装 skill 自身的锁定依赖：`npm ci --prefix "$skill_dir" --ignore-scripts --no-audit --no-fund`。不安装或执行被研究项目。

## 准备材料

输入专用裸仓库、版本及owner/repo名称，一条命令生成材料清单、原文、索引和准备报告：

```sh
node "$skill_dir/scripts/materials/study.mjs" prepare \
  --repo "$repo_dir" --revision "$revision" --name "$repo_name" --out "$prepared_dir"
```

输出路径和计时见终端JSON及preparation.json；相同输入可重跑，失败原因会保存。不同快照使用新目录。准备不需要研究模型，不生成基础材料图。

## 找材料与读原文

以下命令通过materials.mjs调用，均追加--index索引目录。完整参数及读取预算见`node "$skill_dir/scripts/materials/materials.mjs" --help`。

| 命令 | 用途 |
| --- | --- |
| overview | 项目介绍（如有）、材料概况、解析覆盖及限制 |
| find --term / --path | 精确词项或路径匹配；没有问题理解或相关性排名 |
| file --path | 声明/章节定位；--part可看导入、引用或解释归属 |
| read --path | 直接读文件或锚点，有界分页，返回正文与下一页范围 |
| read --requests - --paged true | 从标准输入接收多范围对象，合并重复范围后分页 |
| scenario --id | 场景的起点、过程、结果及关联解释；overview只列简要入口 |
| unit --id | 已交付的单元、研究状态、关联与证据 |
| history [--unit ID / --id EVENT_ID] | 已整理的演化概览、某职责的事件，或一个事件的解释及历史原文；缺少研究时明确报错 |
| coverage | 已交付结构的归属和解释缺口 |
| check | 材料身份和记录合法性；不检查语义真值 |
| review | 可选的记录缺口提示；不是抽查或正确性认证 |
| impact --against | 新旧材料变化可能影响的解释 |

优先直接读，不先写请求文件。start/end可省略，表示从头或读到文件末尾；工具只返回当前页，next直接给出剩余范围与固定版本；将next作为下一次请求即可，不依赖游标文件。

```sh
node "$skill_dir/scripts/materials/materials.mjs" read --index "$material_index" --path src/example.py
```

直接读取默认返回紧凑正文，--format json返回结构化blocks；预算为200行/12000字符，可用--max-lines/--max-chars调小；上限为400行/16000字符，整个返回包也有24000字符上限。单行本身超过字符上限会明确提示，必要时从原文文件查看，不伪装成完整源码。续读不自动登记已阅读或已解释。宿主工具仍需预留足够输出空间，不在一次外层输出中汇总多个大批次。

多范围用--requests - --paged true，从标准输入一次提交`{"ranges":[{"path":"src/example.py","start":10,"end":30}]}`，也可用锚点或证据。分页读取将版本绑定到当前索引，也可显式传revision/modelHash检查期望版本。旧--requests文件入口仍支持，未启用分页时保持完整返回或预算报错的合同。

解析覆盖及延后原因以overview/file结果为准。生成材料仍可读取；需要符号时用build --parse-path指定文件，或--parse-generated true处理全部候选。没有锚点或匹配不表示没有能力，材料引用不等于运行依赖。impact不能判断意义是否改变，也可能漏掉未登记的依赖。

## 写单元与继续研究

初始化后使用 edit 直接提交语义对象，不先生成请求文件或补丁。输入字段和局部编辑规则只在[输入合同](current-model.md)维护。

```sh
node "$skill_dir/scripts/materials/study.mjs" init \
  --index "$material_index" --out "$study_dir" --from - <<'JSON'
{"intro":{"title":"项目名称","text":"根据已读材料填写的项目介绍。"}}
JSON
node "$skill_dir/scripts/materials/study.mjs" edit --study "$study_dir" --from - <<'JSON'
{"unit":{"title":"已发现的职责","summary":"这项职责提供什么。","boundary":"当前确认的边界。"}}
JSON
node "$skill_dir/scripts/materials/study.mjs" edit --study "$study_dir" --id "$unit_id" --from -
```

edit 接收 unit 元信息、explanations（内联证据及独立 coverage）、relations 和 parent，可以只提交一项或同单元的小批内容。沿用返回的单元、解释或关系 ID 更新局部字段，无须重写整个单元。程序入口 editUnit({study,id?,data}) 接收对象；使用字符串入口时让 JSON.stringify 序列化对象，不手工转义长 JSON。

study unit --id 查看作者包，追加 --explanation 或 --relation 只读取一个条目。错误会指出范围或引用问题；修正对应条目后重新提交即可。--expected unitHash 可防止覆盖并发更新。空单元可先保存，导出不接受缺失解释的单元。

项目介绍或场景用 project --from 更新。put 仅用于完整作者包导入/替换；init --model 导入已有模型，不补造理解状态。

## 先架构、再深入

init用--target architecture或--target complete选择本次交付目标，默认complete；两者都从架构阶段开始。旧研究和导入模型不自动补造阶段完成记录。目标切换保留同一研究中的全部单元和材料关系：

```sh
node "$skill_dir/scripts/materials/study.mjs" status --study "$study_dir"
node "$skill_dir/scripts/materials/study.mjs" target --study "$study_dir" --target complete
```

status只返回当前进度和分页单元摘要；需要全局解释缺口或悬空关联时调用coverage。程序读取对应页的单元，不为局部查询计算整个项目状态。

progress --from -直接提交[进度对象](current-model.md)，覆盖当前说明，不保留确认历史。先形成架构、再深入仍是研究顺序；不通过指纹或重复确认来强制执行。标记complete时检查结构合法与零解释归属缺口，不要求先提交架构证明。普通build也可交付阶段成果；覆盖与进度声明分开显示，构建本身不证明研究完成。

## 记录返回范围与复用

初始化后，优先从study入口读取；直接路径、锚点、批量stdin及next范围续读与材料接口相同。每次返回的范围由工具记录，不需要Agent抄写阅读日志。记录失败会明确返回recorded:false及原因，已核验的原文仍可使用。

```sh
node "$skill_dir/scripts/materials/study.mjs" read --study "$study_dir" --path src/example.py --unit "$unit_id"
node "$skill_dir/scripts/materials/study.mjs" readings --study "$study_dir" --path src/example.py
```

read的--unit是当前或计划研究的单元标识，可省略；--reason可说明读取目的。readings返回工具曾返回的范围、该文件尚未返回的范围、去重与重复行数和阶段统计；不覆盖普通shell、浏览器或其他入口的阅读。下一页将read返回的next对象直接作为request或--requests输入。单元解释与待补读位置继续由Agent维护，工具不把返回日志当作理解证明。程序入口为readForStudy({study,request,unit?,reason?})、studyReadings(study)、studyStatus(study)。

## 交付理解图与Agent索引

```sh
node "$skill_dir/scripts/materials/study.mjs" build --study "$study_dir" --out "$delivery_dir"
```

产物和计时由终端JSON及build-summary.json统一返回，包括理解图、Agent索引和覆盖清单，无需逐文件拼报告。网页构建成功后，自动收录到当前工作目录的 `how-this-works-site/`，返回 `site.home` 和 `site.project`；可用 `--site "$site_dir"` 指定已有站点。跨工作目录继续整理时必须传同一站点路径，才能更新同一个主页。同一仓库重新构建更新已有入口，原研究与交付目录保留；主页按收录更新时间展示，不把更新时间当作上游提交日期。`--ui false` 只交付数据，不收录网页。已有模型的高级独立构建用materials build，参数见--help。

页头的中文/English按钮只切换固定界面文案，并记住浏览器里的选择；不会翻译研究正文或原文，也不会重新构建研究数据。

网页同时生成“来源与许可”入口：标明独立解读、上游仓库与固定版本，并原样保留材料中标准命名的 LICENSE、NOTICE、COPYRIGHT 等声明文件，网页组件的许可另行列出。这是文件保留与来源展示，不是授权认证；公开展示前仍需核对所使用材料的具体许可证和独立素材权利，不能把仓库公开或根许可证当作全部内容可任意转载的依据。

理解图使用 skill 内 `assets/web/` 的固定模板，由 `scripts/build_web.mjs` 构建，无需原开发工作区。仅需要数据时显式--ui false，不能把数据交付称为理解图已生成。单元或项目介绍修改后旧导出不可当作当前结果使用，应重新build；不要手改导出文件或移除版本记录。明确读取归档时使用materials命令的--snapshot true。

只修改模板、无需更新研究数据时，可运行 `node "$skill_dir/scripts/build_web.mjs" --out "$delivery_dir"`，再用下面的收录命令更新主页。已有学习页也用同一命令收录，可重复 `--add`：

```sh
node "$skill_dir/scripts/site.mjs" --site "$site_dir" --add "$delivery_dir"
python3 -m http.server 8790 --bind 127.0.0.1 --directory "$site_dir"
```

在浏览器打开 `http://127.0.0.1:8790/`。站点包含主页和各项目的独立网页、材料与声明，整体复制后可用普通静态服务预览，不依赖每个项目分别启动端口。主页由固定模板生成，Agent不手写项目卡片或链接清单；搜索支持项目名称、用途和场景。收录副本提供返回主页入口，原始交付仍可单独服务。旧模板归档可收录但不自动改写其阅读交互。Agent 默认读取仍保留作者数据的当前性检查，脱离原研究读取归档时使用上述 snapshot 模式。这里只生成静态产物，不部署公网。

同一研究目录只允许一个写入操作；提示写锁时先确认没有运行中的写入。更多命令参数见`node "$skill_dir/scripts/materials/study.mjs" --help`，内部存储与锁实现不需要由Agent复写。
