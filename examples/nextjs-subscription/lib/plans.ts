export type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  currency: 'CNY';
  description: string;
  features: string[];
  tutorialUrl: string;
};

export const plans: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    currency: 'CNY',
    description: 'Essential AI prompts and workflows for individuals exploring automation.',
    features: ['10 curated prompt packs', 'Monthly workflow templates', 'Community forum access'],
    tutorialUrl: 'https://example.com/tutorials/starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    currency: 'CNY',
    description: 'Advanced collaboration toolkit built for startups shipping AI products.',
    features: [
      'Unlimited prompt revisions',
      'Team workspace with permissions',
      'Priority email support',
      'Weekly office hours recording',
    ],
    tutorialUrl: 'https://example.com/tutorials/pro',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    currency: 'CNY',
    description: 'Compliance-focused suite with onboarding for security and procurement teams.',
    features: [
      'Custom onboarding workshop',
      'Dedicated solution architect',
      'Usage analytics dashboard',
      'SLA-backed support channel',
    ],
    tutorialUrl: 'https://example.com/tutorials/enterprise',
  },
];

export function findPlan(planId: string): SubscriptionPlan | undefined {
  return plans.find((plan) => plan.id === planId);
}
