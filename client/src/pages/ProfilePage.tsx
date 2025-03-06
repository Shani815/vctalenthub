import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Link, Loader2, Lock, MessageCircle, UserPlus2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import type { Profile, User } from "@/db/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { PaywallModal } from "@/components/PaywallModal";
import { ProfileCard } from "@/components/ProfileCard";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { useRoute } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const messageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(1000, "Message is too long"),
});

type ProfileWithUser = {
  profile: Profile;
  user: User;
  isConnected: boolean;
  connectionStatus: 'not_connected' | 'pending' | 'connected';
  hasIntroRequest?: boolean;
};

type Highlight = {
  id: number;
  title: string;
  type: string;
  description: string | null;
  fileUrl?: string;
  url?: string;
  createdAt: string;
};

export default function ProfilePage() {
  const [, params] = useRoute("/profile/:id");
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [introDialogOpen, setIntroDialogOpen] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: profileData, isLoading, error } = useQuery<ProfileWithUser>({
    queryKey: [`/api/profile/${params?.id}`],
    enabled: !!params?.id,
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
  });

  const { data: highlights } = useQuery<Highlight[]>({
    queryKey: [`/api/highlights/${params?.id}`],
    enabled: !!params?.id,
  });

  const form = useForm({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      content: "",
    },
  });

  const messageMutation = useMutation({
    mutationFn: async (data: z.infer<typeof messageSchema>) => {
      const res = await fetch(`/api/messages/${params?.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      setMessageDialogOpen(false);
      form.reset();
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to send message",
        description: error.message,
      });
    },
  });

  const introMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/intros/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetId: parseInt(params?.id || '0'),
          requesterId: currentUser?.id,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      setIntroDialogOpen(false);
      toast({
        title: "Intro Request Sent",
        description: `Your intro request to ${profileData?.profile.name} has been sent.`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/profile/${params?.id}`] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to send intro request",
        description: error.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-destructive text-center">
              {error instanceof Error ? error.message : "Failed to load profile"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profileData.user.id;
     
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-6">
        <h1 className="text-3xl font-bold">Profile</h1>
        <div className="flex gap-2">
          {!isOwnProfile && (
            <>

              <Dialog open={introDialogOpen} onOpenChange={setIntroDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="secondary" 
                    disabled={profileData.hasIntroRequest || introMutation.isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentUser?.role === 'student' && currentUser?.tier === 'free') {
                        setShowPaywallModal(true);
                        return;
                      }

                      if ((currentUser?.role === 'venture_capitalist' && profileData.user.role === 'startup') ||
                          (currentUser?.role === 'startup' && profileData.user.role === 'venture_capitalist')) {        
                        setShowPaywallModal(true);
                        return;
                      }
                      else setIntroDialogOpen(true);
                    }}
                  >
                    {introMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Requesting...
                      </>
                    ) : profileData.hasIntroRequest ? (
                      <>
                        <UserPlus2 className="mr-2 h-4 w-4" />
                        Intro Requested
                      </>
                    ) : (
                      <>
                        <UserPlus2 className="mr-2 h-4 w-4" />
                        Request BlueBox Intro
                      </>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Introduction</DialogTitle>
                    <DialogDescription>
                      Would you like to request a BlueBox introduction to {profileData.profile.name}?
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIntroDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => introMutation.mutate()}
                      disabled={introMutation.isPending}
                    >
                      {introMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Requesting...
                        </>
                      ) : (
                        "Confirm Request"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <PaywallModal 
                isOpen={showPaywallModal} 
                onClose={() => setShowPaywallModal(false)}
                feature="introRequests"
              />
            </>
          )}
        </div>
      </div>

      <ProfileCard
        profile={profileData.profile}
        userId={profileData.user.id}
        role={profileData.user.role as 'student' | 'venture_capitalist' | 'startup'}
        connectionStatus={profileData.connectionStatus}
        showEditButton={currentUser?.id === profileData.user.id}
      />

      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Professional Highlights</h2>
          {!profileData.isConnected && !isOwnProfile && (
            <div className="flex items-center text-muted-foreground">
              <Lock className="h-4 w-4 mr-2" />
              <span className="text-sm">Connect to view full highlights</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {highlights?.map((highlight) => (
            <Card 
              key={highlight.id}
              className={cn(
                "group relative overflow-hidden transition-all duration-300",
                "backdrop-blur-lg  bg-card/50 shadow-md border-muted-foreground/30",
                !profileData.isConnected && !isOwnProfile && "hover:cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 z-10 transition-all duration-300",
                  !profileData.isConnected && !isOwnProfile && "backdrop-blur-md bg-background/50",
                  profileData.isConnected || isOwnProfile ? "group-hover:backdrop-blur-sm" : ""
                )}
              />
              
              <CardContent className="p-6 relative z-20">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold line-clamp-1">{highlight.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getHighlightTypeLabel(highlight.type)}
                    </p>
                  </div>
                  {!profileData.isConnected && !isOwnProfile ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {highlight.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {highlight.description}
                  </p>
                )}

                {(profileData.isConnected || isOwnProfile) && (
                  <>
                          {highlight.url && <a
                            href={highlight.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center mt-4 text-sm text-primary hover:underline mr-4"
                          >
                            <Link className="mr-2 h-4 w-4" />
                            View URL
                          </a>}
                          {highlight.fileUrl && <a
                            href={highlight.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center mt-4 text-sm text-primary hover:underline"
          
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            View Document
                          </a>}
                          </>
                )}
              </CardContent>

              {!profileData.isConnected && !isOwnProfile && (
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent z-30" />
              )}
            </Card>
          ))}

          {(!highlights || highlights.length === 0) && (
            <Card className="col-span-full p-12 text-center backdrop-blur-sm bg-card/50 border-muted/30">
              <div className="flex flex-col items-center gap-4">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <h3 className="font-semibold">No highlights yet</h3>
                <p className="text-muted-foreground">
                  {isOwnProfile 
                    ? "Start showcasing your professional work by adding your first highlight"
                    : "This user hasn't added any highlights yet"}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function getHighlightTypeLabel(type: string): string {
  const types: Record<string, string> = {
    latest_deals: "Latest Deals",
    cheque_sizes: "Cheque Sizes",
    exits_acquisitions: "Exits & Acquisitions",
    fund_milestones: "Fund Milestones",
    portfolio_wins: "Portfolio Wins",
    media_features: "Media Features",
    fundraising_announcements: "Fundraising Announcements",
    product_launches: "Product Launches",
    revenue_growth: "Revenue & Growth",
    strategic_partnerships: "Strategic Partnerships",
    awards_recognition: "Awards & Recognition",
    projects: "Projects",
    research_papers: "Research Papers",
    internships: "Internship Experience",
    case_competitions: "Case Competitions",
    certifications: "Certifications",
    other: "Other"
  };

  return types[type] || type;
}