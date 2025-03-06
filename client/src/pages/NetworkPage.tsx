import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Search, Users } from "lucide-react";
import type { NetworkConnection, Profile, User } from "@/db/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { NetworkMap } from "@/components/NetworkMap";
import { PaywallModal } from "@/components/PaywallModal";
import { ProfileCard } from "@/components/ProfileCard";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useUser } from "@/hooks/use-user";

interface NetworkData {
  users: (User & {
    profile: Profile;
    connectionStatus: "not_connected" | "pending" | "connected";
  })[];
  connections: NetworkConnection[];
  allUsers: (User & {
    profile: Profile;
    connectionStatus: "not_connected" | "pending" | "connected";
  })[];
  recommendations: {
    userId: number;
    reason: string;
    profile?: Profile;
    connectionStatus: "not_connected" | "pending" | "connected";
  }[];
}

export default function NetworkPage() {
  const { user: currentUser } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  const {
    data: networkData,
    isLoading,
    error,
  } = useQuery<NetworkData>({
    queryKey: ["/api/network"],
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
    retry: false,
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-destructive text-center">
              {error instanceof Error
                ? error.message
                : "Failed to load network data"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!networkData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Your Network</h1>
        <p className="text-muted-foreground">No network data available.</p>
      </div>
    );
  }

  const filteredUsers = networkData.users.filter((user) => {
    const matchesSearch =
      !searchQuery ||
      user.profile?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profile?.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profile?.university
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      user.profile?.company?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PaywallModal 
        isOpen={showPaywallModal} 
        onClose={() => setShowPaywallModal(false)}
        feature="connections"
      />

      <h1 className="text-3xl font-bold mb-8">Your Network</h1>

      {networkData.recommendations &&
        networkData.recommendations.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Recommended Connections</CardTitle>
              </div>
              <CardDescription>
                People you might want to connect with based on your interests
                and goals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {networkData.recommendations.map((rec, i) => (
                <Link
                  key={i}
                  href={`/profile/${rec.userId}`}
                  className="block group"
                >
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {rec.profile?.name?.[0] || "#"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium group-hover:text-primary transition-colors">
                        {rec.profile?.name || `User #${rec.userId}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {rec.reason}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Discover</h2>
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, university, or company..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="student">MBA Students</SelectItem>
                  <SelectItem value="venture_capitalist">
                    Venture Capitalists
                  </SelectItem>
                  <SelectItem value="startup">Startups</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(
            (user) =>
              user.profile && (
                <Link key={user.id} href={`/profile/${user.id}`}>
                  <div className="cursor-pointer transition-transform hover:scale-[1.02]">
                    <ProfileCard
                      profile={user.profile}
                      userId={user.id}
                      role={
                        user.role as
                          | "student"
                          | "venture_capitalist"
                          | "startup"
                      }
                      connectionStatus={user.connectionStatus}
                    />
                  </div>
                </Link>
              )
          )}
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm p-4">
        <h2 className="text-2xl font-semibold mb-4">Network Map</h2>
        <NetworkMap
          users={networkData.allUsers}
          connections={networkData.connections}
          width={typeof window !== "undefined" ? window.innerWidth * 0.8 : 800}
          height={600}
          currentUserId={currentUser.id}
        />
      </div>
    </div>
  );
}
