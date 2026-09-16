# 历史命令与事件输入

仅在任务要求历史、时间窗或跨项目研究时使用。需要Python >=3.9和Git；SCRIPT指向scripts/evolution.py。参数以`python3 "$SCRIPT" --help`或对应子命令--help为准。

| 命令 | 功能及主要输入 |
| --- | --- |
| sync | 获取/更新专用裸仓库：--slug owner/repo --repo目录 |
| collect | 收集固定时间窗：--repo、--slug、--since、--until、--out；可用--revision固定版本 |
| inspect | 取得选定提交及路径的前后材料：--collection、--sha、--path、--out |
| snapshot | 读取窗口末快照及指定路径：--collection、--path、--out |
| compare | 比较两次采集：--old、--new、--out |
| validate | 检查事件引用：--events、可重复的--collection |
| render | 生成事件时间轴和问题索引：--events、--collection、--out、--timezone |
| export | 核验并导出事件、提交日期及历史版本原文，供当前研究导入；--events（支持`-`标准输入）、--collection |

since/until须含时区，使用左闭右开的时间窗。collect需要完整历史；sync会补齐专用浅仓库。当前状态准备可以使用浅仓库，不要为了当前研究调用collect。按实际材料确认重点路径后可指定--focus-prefix；候选是定位线索，不是重要性判断。

collect返回manifest.json、commits.jsonl、candidates.json及index.md。输出不可覆盖时使用新目录。inspect/snapshot的截断情况写入metadata；缩小范围或调整--max-bytes后重取，不以截断内容支撑超出范围的结论。缓存与时间计算由脚本执行，不手工重算。

render的--timezone指定统一展示时区；月统计索引采用UTC，跨月比较需注意两者口径。时间和历史解释边界见[研究判断](research-contract.md)。

## events.json输入

顶层为`{"schema_version":1,"events":[...]}`。每个事件含唯一id、repo、commit_shas、非空problem_ids、summary及claims。

claim含level（fact/inference/hypothesis）、text和evidence；前两者需要证据，hypothesis可暂缺。证据含commit、path、start_line、end_line；版本限定为该事件提交及其第一父。可附before、after、motivation、tradeoff、missing_evidence，明确的动机仍需对应依据。

问题归类与事件解释由Agent提供，validate/render不会生成语义结论。历史事件通过下方 history 入口导入，不直接作为当前单元模型。

## 接到当前学习产物

使用 `study.mjs history --study "$study_dir" --collection "$collection_dir" --from -` 直接提交事件对象，也可传已有事件文件；程序入口为 `importHistory({study,collection,data})`。随后运行普通 `study build`，同一模型生成网页和 Agent 历史索引，不逐项目编写页面。

此入口要求顶层 summary（整体演化解释）与 scope（实际研究范围）；每个事件另含 title、before、after、units（相关的现存职责 ID，可为空），可附 motivation、tradeoff、missing_evidence。根提交没有可比较的父版本，正文须直说。已退出的方案保留为历史事件，不为关联而虚构现存职责。

collection 的仓库与截止 revision 必须与当前研究一致。历史证据使用事件提交或第一父的原文，工具取得日期、前后版本标记与片段；不放入当前快照的 evidence 或解释覆盖。引用校验不证明正文正确，也不将提案自动标为已落实。保留作者说明、研究推断、往返修正和未知理由。

Agent 从 `materials.mjs history --index "$index"` 取事件概览，加 `--unit ID` 按职责取概览，加 `--id EVENT_ID` 读一个事件及版本原文。`overview` 和 `unit` 也返回历史入口。把交付的 Agent 索引目录及本 skill 交给后续 Agent；网页打开本身不构成 Agent 已知上下文。
