export type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  currency: 'CNY';
  billingCycle: string;
  description: string;
  features: string[];
  tutorialUrl: string;
  highlight?: string;
};

export const plans: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: '入门体验版',
    price: 20,
    currency: 'CNY',
    billingCycle: '月',
    description: '快速体验核心 AI 工作流，为个人开发者提供低门槛的入门方案。',
    features: ['10 份精选提示词包', '每月自动化模版更新', '社区交流与答疑'],
    tutorialUrl: 'https://example.com/tutorials/starter',
  },
  {
    id: 'pro',
    name: '专业成长版',
    price: 80,
    currency: 'CNY',
    billingCycle: '半年',
    description: '协作与运营一体化，为成长型团队打造高效协同工作台。',
    features: ['无限提示词迭代', '团队空间与权限管理', '优先邮箱支持', '每周实战直播回放'],
    tutorialUrl: 'https://example.com/tutorials/pro',
    highlight: '热门推荐',
  },
  {
    id: 'enterprise',
    name: '企业旗舰版',
    price: 120,
    currency: 'CNY',
    billingCycle: '一年',
    description: '面向企业的安全合规方案，覆盖交付、运维与监控分析。',
    features: ['定制化入门培训', '专属解决方案架构师', '使用分析与报表', 'SLA 专线支持'],
    tutorialUrl: 'https://example.com/tutorials/enterprise',
  },
  {
    id: 'ultimate',
    name: '全栈私有版',
    price: 360,
    currency: 'CNY',
    billingCycle: '不限时',
    description: '提供私有化部署与专项顾问服务，满足严苛的合规与扩展需求。',
    features: [
      '专属私有化部署方案',
      '7x24 专属顾问支持',
      '季度业务评估与优化',
      '高级安全审计与巡检',
    ],
    tutorialUrl: 'https://example.com/tutorials/ultimate',
  },
];

export function findPlan(planId: string): SubscriptionPlan | undefined {
  return plans.find((plan) => plan.id === planId);
}
