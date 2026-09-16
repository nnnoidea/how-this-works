<script>
 import {t} from '../../ui-language.js';
 let {source}=$props();
</script>
{#if source}
 <details class="source-notice" data-source-notice>
  <summary><strong>How This Works</strong>{$t(" · 独立项目解读 ")}<span>{$t("来源与许可")}</span></summary>
  <div>
   <h3>{$t("研究对象与原始材料")}</h3>
   <p><a href={source.repositoryUrl} target="_blank" rel="noreferrer">{source.repo} ↗</a> · <a href={source.versionUrl} target="_blank" rel="noreferrer">{$t("固定版本 ")}{source.revision.slice(0,8)} ↗</a></p>
   <p>{$t("本页由 How This Works 整理，属于独立研究解读，不代表上游项目的官方文档或背书。原文按固定版本保留；解释、图示与行号展示由本页生成。")}</p>
   <h3>{$t("上游许可与署名文件")}</h3>
   <ul>{#each source.notices as item}<li><a href={item.href} target="_blank" rel="noreferrer">{item.path} ↗</a></li>{:else}<li>{$t("未发现标准命名的许可文件，不能据此推断原作者授予转载许可。")}</li>{/each}</ul>
   <p>{$t("源材料适用其各自许可。这里保留发现的声明文件，不构成对所有材料授权状态的认证。")}</p>
   <a href="THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">{$t("网页组件的第三方许可 ↗")}</a>
  </div>
 </details>
{/if}
<style>
 .source-notice{position:relative;flex-shrink:0;border-top:1px solid #dce5d7;padding:7px 22px;background:#fff;color:#71826b;font:11px/1.7 system-ui;z-index:20}.source-notice summary{cursor:pointer}.source-notice summary strong{color:#426750}.source-notice summary span{margin-left:15px}.source-notice>div{position:absolute;bottom:calc(100% + 7px);right:16px;width:min(620px,calc(100vw - 32px));box-sizing:border-box;max-height:65vh;overflow:auto;padding:20px 24px;border:1px solid #cddcc7;border-radius:10px;background:white;box-shadow:0 8px 40px #223b3020;color:#435b42;font-size:13px;line-height:1.9;overflow-wrap:anywhere}.source-notice h3{font-size:14px;margin:6px 0 12px}.source-notice ul{padding-left:20px}.source-notice a{color:#3b7658}.source-notice p{margin:12px 0}
</style>
