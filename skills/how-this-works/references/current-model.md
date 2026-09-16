# 研究输入合同

新研究使用 v3。命令见[当前命令](material-supply.md)。Agent提供解释与判断，脚本维护存储标识、关联和导出结构。

## 项目与进度

init 输入包含 intro.title/text；可附 intro.example（注明示意或实测）、intro.map、displayName、omitted、validationNote，以及 scenarios（场景过程，见下文）。repo 与 revision 来自材料索引。

progress 输入为 `{"stage":"deepening","summary":"整体理解","remaining":["尚未深入的范围"]}`。stage 为 architecture/deepening/complete。summary 和 remaining 只写理解与研究缺口；单元/解释/关系数量和构建结果由脚本及页面生成，不在正文重复填写构建待办。研究目标由 target 维护。完整整理要求零解释归属缺口，进度声明不证明语义正确。

## 场景过程

用 project 提交 scenarios；每个场景含 id、label、description、start（起点）、outcome（结果与边界）、steps。步骤是按实际过程编写的可读解释，含 title、text、nodes（承担这一步的单元 ID）与 claims（这些单元中支撑解释的段落 ID）。脚本从步骤生成场景的参与单元集合，不手工重复维护。引用错误会在导出时指出场景与步骤。

```json
{"scenarios":[{"id":"one-task","label":"完成一件具体工作","description":"这个场景解决什么问题。",
 "start":"读者面对什么情况。","outcome":"得到什么，以及可能停在哪里。",
 "steps":[{"title":"第一步发生什么","text":"解释条件、行为、分工与例外。",
 "nodes":["已有单元ID"],"claims":["该单元已有的解释ID"]}]}]}
```

从已有解释与源码复用证据；如果缺少依据，先补读并写入对应单元。步骤顺序、条件和分支来自材料判断，不按节点位置或引用关系推定。不要把全项目的共同根节点当成场景的全部参与者。没有步骤的旧场景仍可查看关联职责，但页面明确标示尚未整理过程，不伪造流程。

理解图提供项目、场景、步骤和职责入口；场景与步骤复用同一职责，不改变单元父子关系。Agent先从overview选择场景，再用scenario --id读过程、unit --id读需要的职责。无需一次读取全部场景正文。

## 小范围写入：edit

首次省略 --id，提交 unit 的 title、summary、boundary 建立单元；以后沿用返回的单元 id。一个请求可以提交同一单元的数条解释和关系。只写需要改变的字段，省略的内容保留；空单元可暂存，但不能作为已完成研究导出。

```json
{
  "unit":{"title":"返回执行结果","summary":"根据实际材料填写。","boundary":"本单元解释的范围。"},
  "explanations":[{
    "title":"失败时保留什么","text":"连贯解释条件、行为与边界。","level":"fact",
    "evidence":[{"path":"src/example.py","start":10,"end":15,
      "role":"implementation","note":"这个分支保留失败信息。","reviewed":true}],
    "coverage":[{"path":"src/example.py","start":8,"end":18,
      "status":"explained","note":"解释这一分支的入口与结果。"}]
  }]
}
```

工具返回 changed.explanations / changed.relations 中的 id。更新解释时，传该 id 及修改的字段，例如 `{"explanations":[{"id":"工具返回的ID","text":"修订后的正文"}]}`。修改 coverage 不需要重发正文或证据；修改 evidence 不需要重发覆盖范围。显式 evidence/coverage 数组替换该解释的对应集合，coverage:[] 清除该解释的覆盖。`{"id":"...","remove":true}` 删除一条解释或关系；删除解释同时移除它的覆盖关联，不删除其他解释。

level 取 fact/author/inference。evidence 直接附在解释中，每项为固定版本的 path 和一基 start/end，或工具返回的 anchor；kind、label 可省略。role 取 declaration/implementation/test/observation，note 说明具体支持什么；不能根据文件后缀推定角色。reviewed:true 仅表示研究者确已核对该证据，不表示运行验证或完整理解。

coverage 与 evidence 独立。每项 path、start/end、status、note；status 为 pending/explained。空文件或不可读材料使用 wholeFile:true，省略行号。允许同一范围归属多个解释或单元。证据引用不会自动产生解释覆盖，生成材料也不从缺口中消失。

unit.study 可局部更新 depth、scope、openQuestions、nextReads。depth 取 located/explained/traced；scope 限定实际理解范围，openQuestions 每项 question/impact，nextReads 每项 path/reason，可附 start/end。首次默认 located，scope 默认单元 boundary；提升深度需有明确核对过的证据。核对记录由 evidence.reviewed 写入，不手工维护证据 ID。

## 关系与组成

```json
{"relations":[{"target":"另一单元ID","kind":"cooperation",
 "label":"提交执行结果","text":"说明两者如何协作以及成立条件。",
 "evidence":[{"path":"src/example.py","start":20,"end":25}]}]}
```

relations 的 kind 为 cooperation/feedback。传返回的关系 id 可只修改 text、label、target 或 evidence。省略保留，删除需明确 remove:true。

组成使用子单元上的 parent：`{"parent":{"id":"父单元ID","text":"为何属于这个职责","evidence":[{"path":"src/example.py","start":1,"end":5}]}}`。脚本生成组成关系，不再同时维护反向边。parent:null 移除父归属。层级由研究发现，不按目录预填；未建立的目标单元可暂存，最终导出会检查完整性。

## 已有数据

study unit 返回保存的作者包；--explanation 或 --relation 可只读取一个条目及其内联证据，便于局部修订。--expected unitHash 可检查并发变化。

put / putUnit 保留为已有作者包的完整导入和替换入口，接收 unit、evidence 及可选 relations、parentEvidence、parentNote。它不是日常编辑入口；使用已保存的包，不手工重建全局 ID 映射。init --model 可导入现有模型；旧 v2 未记录的阅读状态不补造。历史 concepts/questions/events 不自动转换为当前解释。
