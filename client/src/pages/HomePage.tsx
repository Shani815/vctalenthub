import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Job } from "@/db/schema";
import { JobCard } from "@/components/JobCard";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";

type JobWithCompany = Job & {
  company: {
    name: string;
  };
};

interface NewsArticle {
  title: string;
  source: string;
  date: string;
  category: string;
  url: string;
  summary: string;
  imageUrl?: string;
}

export default function HomePage() {
  const { user } = useUser();

  const { data: jobs, isLoading: isLoadingJobs } = useQuery<JobWithCompany[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: roundup, isLoading: isLoadingRoundup } = useQuery<{ headlines: NewsArticle[] }>({
    queryKey: ['/api/roundup'],
    refetchInterval: false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          {user?.role === 'student' ? (
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-primary to-blue-600 text-transparent bg-clip-text">
                Welcome to Your MBA Home for VC & Startups
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Connect with top venture capital firms and startups that match your career aspirations.
              </p>
              <div className="flex justify-center gap-4">
                <Button asChild size="lg">
                  <Link href="/jobs">View Opportunities</Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/highlights">Add Highlights</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-primary to-blue-600 text-transparent bg-clip-text">
                Welcome to Your Talent Hub
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Connect with exceptional MBA talent to drive your venture's growth.
              </p>
              <div className="flex justify-center gap-4">
                <Button asChild size="lg">
                  <Link href="/hire?tab=my-jobs">Post a Job</Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/hire?tab=browse">Browse Talent</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Headlines Section */}
      <section className="py-16 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
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
              {isLoadingRoundup ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : roundup?.headlines ? (
                <div className="space-y-6">
                  {roundup.headlines.map((article, i) => (
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
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">Failed to load headlines</p>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Latest Opportunities Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold mb-6">
            {user?.role === 'student' ? 'Latest Opportunities' : 'Your Active Listings'}
          </h2>

          {isLoadingJobs ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {jobs.slice(0, 3).map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  {user?.role === 'student'
                    ? 'No opportunities available at the moment. Check back soon!'
                    : 'No active job listings. Post your first job to start connecting with talent!'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}