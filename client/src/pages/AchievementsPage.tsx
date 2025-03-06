import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, Trophy } from "lucide-react";

import type { Achievement } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface UserAchievement {
  id: number;
  userId: number;
  achievementId: number;
  currentProgress: number;
  status: 'locked' | 'in_progress' | 'completed';
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  achievement: Achievement;
}

export default function AchievementsPage() {
  const [, setLocation] = useLocation();

  // Add role check using the /api/user endpoint
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
  });

  // Redirect admin users away from this page
  if (user?.role === 'admin') {
    setLocation("/admin/analytics");
    return null;
  }

  const { data: achievements, isLoading } = useQuery<UserAchievement[]>({
    queryKey: ['/api/achievements'],
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!achievements) {
    return null;
  }

  const totalPoints = achievements.reduce((sum, ua) => 
    ua.status === 'completed' ? sum + ua.achievement.rewardPoints : sum, 
    0
  );

  const formatDate = (date: string | Date | null) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-500';
      case 'in_progress':
        return 'text-amber-500';
      default:
        return 'text-gray-400';
    };
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Professional Achievements</h1>
          <p className="text-muted-foreground mt-1">
            Track your networking milestones and earn recognition
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">
            {totalPoints}
            <span className="text-sm font-normal text-muted-foreground ml-2">points earned</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {achievements.map((userAchievement) => (
          <Card 
            key={userAchievement.id}
            className={`transition-shadow duration-200 hover:shadow-md ${
              userAchievement.status === 'completed' ? 'bg-primary/5' : ''
            }`}
          >
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {userAchievement.status === 'completed' ? (
                    <Trophy className="h-6 w-6 text-primary" />
                  ) : userAchievement.status === 'in_progress' ? (
                    <div className="relative">
                      <Trophy className="h-6 w-6 text-primary/40" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <Lock className="h-6 w-6 text-muted-foreground/60" />
                  )}
                  <div>
                    <CardTitle className="text-lg">{userAchievement.achievement.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {userAchievement.achievement.description}
                    </p>
                  </div>
                </div>
                <Badge variant={userAchievement.status === 'completed' ? 'default' : 'secondary'}>
                  {userAchievement.achievement.rewardPoints} pts
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {userAchievement.status === 'in_progress' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {userAchievement.currentProgress} / {userAchievement.achievement.requiredProgress}
                    </span>
                  </div>
                  <Progress 
                    value={(userAchievement.currentProgress / userAchievement.achievement.requiredProgress) * 100} 
                    className="h-2"
                  />
                </div>
              )}
              {userAchievement.status === 'completed' && userAchievement.completedAt && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Completed on</span>
                  <span className="font-medium">{formatDate(userAchievement.completedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}