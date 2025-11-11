export type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  currency: 'CNY';
  description: string;
  features: string[];
  tutorialUrl: string;
  highlight?: string;
};

export const plans: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: '入门版',
    price: 29,
    currency: 'CNY',
    description: '快速体验核心 AI 工作流，个人开发者的高性价比之选。',
    features: ['10 份精选提示词包', '每月更新自动化模版', '社区交流与答疑'],
    tutorialUrl: 'https://example.com/tutorials/starter',
  },
  {
    id: 'pro',
    name: '专业版',
    price: 79,
    currency: 'CNY',
    description: '协作与运营一体化，助力小团队快速上线 AI 产品。',
    features: ['无限提示词迭代', '团队空间与权限管理', '优先邮箱支持', '每周实战直播回放'],
    tutorialUrl: 'https://example.com/tutorials/pro',
    highlight: '热门推荐',
  },
  {
    id: 'enterprise',
    name: '团队版',
    price: 199,
    currency: 'CNY',
    description: '面向企业的安全合规方案，覆盖全流程交付与运维。',
    features: ['定制化入门培训', '专属解决方案架构师', '使用分析与报表', 'SLA 专线支持'],
    tutorialUrl: 'https://example.com/tutorials/enterprise',
  },
];

export function findPlan(planId: string): SubscriptionPlan | undefined {
  return plans.find((plan) => plan.id === planId);
}
