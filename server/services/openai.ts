interface NetworkDigestResponse {
  insights: string[];
  suggestedTopics: string[];
}

interface RecommendedConnection {
  userId: number;
  reason: string;
}

export async function generateRecommendedConnections(
  userProfile: any,
  networkData: any,
): Promise<RecommendedConnection[]> {
  // Return mock data for now
  return [
    {
      userId: 2,
      reason: "Similar interests in venture capital and early-stage startups",
    },
    {
      userId: 3,
      reason: "Both focused on technology sector investments",
    }
  ];
}

export async function generateNetworkingDigest(
  userProfile: any,
  networkData: any,
  recentPosts: any
): Promise<NetworkDigestResponse> {
  // Return mock data for now
  return {
    insights: [
      "Rising trend in AI/ML startups seeking early-stage funding",
      "Increased focus on sustainable technology investments",
      "Growing interest in B2B SaaS solutions",
    ],
    suggestedTopics: [
      "Impact of AI on venture capital decision-making",
      "Sustainable technology investment opportunities",
      "Early-stage startup valuation methods",
      "B2B SaaS market trends"
    ]
  };
}