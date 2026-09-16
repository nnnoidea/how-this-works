export const materialKind=k=>({code:'代码',document:'文档',design:'文档',instruction:'指令文档',skill:'Skill',config:'配置',test:'测试',asset:'资源'}[k]||'材料');
export const supportRole=k=>({declaration:'声明依据',implementation:'实现依据',test:'测试断言',observation:'运行观察'}[k]||'依据性质未记录');
export const studyDepth=k=>({located:'仅定位',explained:'已解释',traced:'已追踪关键实现'}[k]||'阅读深度未记录');
