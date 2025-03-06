import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Edit, Loader2, UserCheck, UserPlus2 } from "lucide-react";
import type { Profile, User } from "@/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditProfileDialog } from "./EditProfileDialog";
import { Link } from "wouter";
import { PaywallModal } from "@/components/PaywallModal";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

// Add temp type to User
interface UserWithTemp extends Omit<User, 'password'> {
  temp?: {
    weeklyConnectionRequests: number;
    totalJobApplications: number;
    daysUntilWeeklyReset: number;
    weeklyResetDate: Date;
  };
}

type ProfileCardProps = {
  profile: Profile;
  userId: number;
  role: 'student' | 'venture_capitalist' | 'startup';
  connectionStatus?: 'not_connected' | 'pending' | 'connected';
  showEditButton?: boolean;
  className?: string;
};

export function ProfileCard({
  profile,
  userId,
  role,
  connectionStatus = 'not_connected',
  showEditButton = false,
  className = ""
}: ProfileCardProps) {
  const { user } = useUser() as { user: UserWithTemp | null };
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<'connections' | 'introRequests' | 'viewConnections'>('connections');

  const initials = profile.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();

  // Clean and normalize skills array
  const normalizeArray = (array: any): string[] => {
    if (!array) return [];
    // If it's already an array of strings, return it after filtering empty and null values
    if (Array.isArray(array) && array.every(data => typeof data === 'string')) {
      return array.filter(data => data !== "" && data !== "null" && data !== undefined && data !== "[]");
    }
  
    // If it's a string, try to parse it
    if (typeof array === 'string') {
      try {
        // Handle nested JSON strings by parsing repeatedly
        let parsed = array;
        while (typeof parsed === 'string') {
          try {

            parsed = JSON.parse(parsed);

          } catch {
            break;
          }
        }
        return Array.isArray(parsed)
          ? parsed.map(String).filter(data => data !== "" && data !== "null" && data !== undefined && data !== "[]")
          : [String(parsed)].filter(data => data !== "" && data !== "null" && data !== undefined && data !== "[]");
      } catch {
        // If parsing fails, split by comma
        return array
          .split(',')
          .map(a => a.trim())
          .filter(Boolean);
      }
    }
  
    // If it's an array but not of strings, convert elements to strings and filter out empty/null
    if (Array.isArray(array)) {
      return array
        .map(data => String(data).trim())
        .filter(data => data !== "" && data !== "null" && data !== undefined && data !== "[]");
    }
  
    return [];
  };
  

  const displaySkills = normalizeArray(profile.skills);
  const displayIndustry = normalizeArray(profile.industry);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/network/connect/${userId}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to send connection request');
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidate both network and user queries to refresh the connection status and counts
      queryClient.invalidateQueries({ queryKey: [`/api/network`] });
      queryClient.invalidateQueries({ queryKey: [`user`] });
      queryClient.invalidateQueries({ queryKey: [`/api/profile/${userId}`] });
      toast({
        title: "Connection request sent",
        description: `A connection request has been sent to ${profile.name}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to send connection request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleViewConnections = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (user?.tier === 'free') {
      setPaywallFeature('viewConnections');
      setShowPaywallModal(true);
      return;
    }
    // Add your connection viewing logic here
  };

  const renderConnectionButton = () => {
    // If the user is viewing their own profile, don't show the button
    if (!user || user.id === userId) {
      return null;
    }

    if (connectionStatus === 'connected') {
      return (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleViewConnections}>
            <UserCheck className="mr-2 h-4 w-4" />
            View Network
          </Button>
        </div>
      );
    }

    if (connectionStatus === 'pending') {
      return (
        <Button variant="secondary" size="sm" disabled>
          <Clock className="mr-2 h-4 w-4" />
          Pending
        </Button>
      );
    }

    return (
      <>
        <Button
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Check if user has reached weekly connection limit
            if (user.tier === 'free' && (user.temp?.weeklyConnectionRequests ?? 0) >= 4) {
              setPaywallFeature('connections');
              setShowPaywallModal(true);
              return;
            }
            connectMutation.mutate();
          }}
          disabled={connectMutation.isPending}
        >
          {connectMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <UserPlus2 className="mr-2 h-4 w-4" />
              Connect
            </>
          )}
        </Button>

        <PaywallModal
          isOpen={showPaywallModal}
          onClose={() => setShowPaywallModal(false)}
          feature={paywallFeature}
        />
      </>
    );
  };
  
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar className="h-20 w-20 border-2 border-primary/10">
          {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} />}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="group-hover:text-primary transition-colors">
                {profile.name}
              </CardTitle>
              <CardDescription>{profile.university || profile.company}</CardDescription>
              <Badge variant="secondary" className="mt-1">
                {role === 'student'
                  ? 'MBA Student'
                  : role === 'venture_capitalist'
                    ? 'Venture Capitalist'
                    : 'Startup'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {renderConnectionButton()}
              {showEditButton && (
                <EditProfileDialog
                  profile={profile}
                  trigger={
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {profile.bio && (
          <p className="text-sm text-muted-foreground mb-4">{profile.bio}</p>
        )}

        {displaySkills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {displaySkills.map((skill, i) => (
              <Badge key={i} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          {profile.location && (
            <div>
              <span className="font-medium">Location:</span> {profile.location}
            </div>
          )}
          {profile.graduationYear && (
            <div>
              <span className="font-medium">Class of:</span> {profile.graduationYear}
            </div>
          )}
          {profile.companySize && (
            <div>
              <span className="font-medium">Company Size:</span> {profile.companySize}
            </div>
          )}
          {displayIndustry.length > 0 && (
            <div>
              <span className="font-medium">Industries:</span>
              <div className="flex flex-wrap gap-2 mb-4">
                {displayIndustry.map((industry, i) => (
                  <Badge key={i} variant="secondary">
                    {industry}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}