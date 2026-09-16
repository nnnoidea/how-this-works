<script>
 import {t,toggleLanguage} from '../../ui-language.js';
</script>
<button class="ui-language" data-ui-language aria-label={$t('界面语言')} title={$t('只切换固定界面文案，项目解释与原文保持不变')} onclick={toggleLanguage}>{$t.language==='zh'?'English':'中文'}</button>
<style>
 .ui-language{flex-shrink:0;padding:6px 10px;border:1px solid #cddcc7;border-radius:6px;background:white;color:#316c59;cursor:pointer;font:12px/1.5 system-ui;white-space:nowrap}.ui-language:focus-visible{outline:2px solid #548267;outline-offset:2px}
</style>
