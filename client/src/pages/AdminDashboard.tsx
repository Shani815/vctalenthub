import {
  Activity,
  BarChart2,
  Briefcase,
  CreditCard,
  MessageSquare,
  TrendingUp,
  Users
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface Analytics {
  overview: {
    totalUsers: number;
    dailyActiveUsers: number;
    monthlyActiveUsers: number;
    premiumUsers: number;
    conversionRate: number;
  };
  topContributors: {
    jobPosters: Array<{
      userId: number;
      username: string;
      count: number;
    }>;
    engagedUsers: Array<{
      userId: number;
      username: string;
      postCount: number;
      commentCount: number;
      totalEngagement: number;
    }>;
  };
  trends: {
    userGrowth: Array<{
      month: string;
      count: number;
    }>;
    activityTrends: Array<{
      date: string;
      logins: number;
      posts: number;
      comments: number;
    }>;
  };
  retention: {
    totalUsers: number;
    returnedUsers: number;
    retentionRate: number;
  };
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
      <BarChart2 className="h-12 w-12 mb-2 opacity-50" />
      <p>{message}</p>
    </div>
  );
}

function AdminDashboard() {
  const [timeRange, setTimeRange] = useState("30");
  
  const { data, isLoading, error, refetch } = useQuery<Analytics>({
    queryKey: ['analytics', timeRange],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/admin/analytics?timeRange=${timeRange}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const jsonData = await response.json();
        return jsonData;
      } catch (error) {
        throw error;
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  // Effect to refetch data when timeRange changes
  useEffect(() => {
    refetch();
  }, [timeRange, refetch]);

  const handleTimeRangeChange = (newRange: string) => {
    setTimeRange(newRange);
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="w-full">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="h-8 w-8 text-destructive" />
              <h1 className="text-2xl font-bold">Error Loading Analytics</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Failed to load analytics data. Please try again later.
              {error instanceof Error ? `: ${error.message}` : ''}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Platform Overview</h1>
        <Select value={timeRange} onValueChange={handleTimeRangeChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : data ? (
              <>
                <div className="text-2xl font-bold">
                  {data.overview.totalUsers.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.overview.dailyActiveUsers.toLocaleString()} active today
                </p>
              </>
            ) : (
              <EmptyState message="No user data available" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Active Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : data ? (
              <>
                <div className="text-2xl font-bold">
                  {data.overview.monthlyActiveUsers.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {((data.overview.monthlyActiveUsers / data.overview.totalUsers) * 100).toFixed(1)}% of total users
                </p>
              </>
            ) : (
              <EmptyState message="No activity data available" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Premium Users</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : data ? (
              <>
                <div className="text-2xl font-bold">
                  {data.overview.premiumUsers.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.overview.conversionRate}% conversion rate
                </p>
              </>
            ) : (
              <EmptyState message="No premium user data available" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Retention</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : data ? (
              <>
                <div className="text-2xl font-bold">
                  {data.retention.retentionRate}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.retention.returnedUsers.toLocaleString()} returned users
                </p>
              </>
            ) : (
              <EmptyState message="No retention data available" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Growth and Activity Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>Monthly user registration trend</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : data && data.trends.userGrowth.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trends.userGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="No user growth data available" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Activity</CardTitle>
            <CardDescription>User engagement metrics over time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : data && data.trends.activityTrends.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trends.activityTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="logins" stroke="#3b82f6" name="Logins" />
                    <Line type="monotone" dataKey="posts" stroke="#10b981" name="Posts" />
                    <Line type="monotone" dataKey="comments" stroke="#f59e0b" name="Comments" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="No activity trend data available" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Contributors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Job Posters</CardTitle>
            <CardDescription>Users with most job postings</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead className="text-right">Jobs Posted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-8" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : data && data.topContributors.jobPosters.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead className="text-right">Jobs Posted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topContributors.jobPosters.map((poster) => (
                    <TableRow key={poster.userId}>
                      <TableCell>{poster.username}</TableCell>
                      <TableCell className="text-right">{poster.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message="No job posting data available" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most Engaged Users</CardTitle>
            <CardDescription>Users with highest activity</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead className="text-right">Posts</TableHead>
                    <TableHead className="text-right">Comments</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-8" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : data && data.topContributors.engagedUsers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead className="text-right">Posts</TableHead>
                    <TableHead className="text-right">Comments</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topContributors.engagedUsers.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell>{user.username}</TableCell>
                      <TableCell className="text-right">{user.postCount}</TableCell>
                      <TableCell className="text-right">{user.commentCount}</TableCell>
                      <TableCell className="text-right">{user.totalEngagement}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message="No user engagement data available" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Engagement Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>User Engagement Distribution</CardTitle>
          <CardDescription>Breakdown of user activities</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : data && data.trends.activityTrends.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Logins', value: data.trends.activityTrends.reduce((sum, day) => sum + day.logins, 0) },
                      { name: 'Posts', value: data.trends.activityTrends.reduce((sum, day) => sum + day.posts, 0) },
                      { name: 'Comments', value: data.trends.activityTrends.reduce((sum, day) => sum + day.comments, 0) },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.trends.activityTrends.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No engagement distribution data available" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminDashboard;