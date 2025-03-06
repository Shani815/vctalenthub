import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Sparkles, MessageSquare, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface NewsArticle {
  title: string;
  source: string;
  date: string;
  category: string;
  url: string;
  summary: string;
  imageUrl?: string;
}

interface DigestData {
  headlines: NewsArticle[];
  insights: string[];
  suggestedTopics: string[];
}

export default function DigestPage() {
  const { user } = useUser();

  const { data: digest, isLoading, error } = useQuery<DigestData>({
    queryKey: ['/api/roundup'],
    refetchInterval: false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-2xl mx-auto my-8">
        <CardContent className="py-8 text-center">
          <p className="text-destructive">Failed to load roundup data</p>
        </CardContent>
      </Card>
    );
  }

  if (!digest) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Your Roundup</h1>
      <p className="text-muted-foreground mb-8">
        Personalized insights and conversation starters based on your network
      </p>

      {/* Top Headlines */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            <CardTitle>Top Headlines</CardTitle>
          </div>
          <CardDescription>
            Latest news from the startup and VC ecosystem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {digest.headlines.map((article, i) => (
              <a 
                key={i} 
                href={article.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="flex gap-4 hover:bg-muted/50 p-2 rounded-lg transition-colors">
                  {article.imageUrl && (
                    <div className="flex-shrink-0">
                      <img 
                        src={article.imageUrl} 
                        alt={article.title}
                        className="w-24 h-24 object-cover rounded-md"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {article.summary}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary">{article.category}</Badge>
                      <span className="text-sm text-muted-foreground">{article.source}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Industry Insights */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Industry Insights</CardTitle>
          </div>
          <CardDescription>
            Key trends and observations from your network
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {digest.insights.map((insight, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Conversation Starters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle>Conversation Starters</CardTitle>
          </div>
          <CardDescription>
            Suggested topics to discuss with your network
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {digest.suggestedTopics.map((topic, i) => (
              <div
                key={i}
                className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
              >
                {topic}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}