import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronDown,
  ChevronUp,
  Hash,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { Post, PostComment, Profile, User } from "@/db/schema";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PostCard } from "@/components/PostCard";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

type ExtendedPost = Post & {
  author: User & { profile: Profile };
  likes: { userId: number }[];
  comments: (PostComment & { author: User & { profile: Profile } })[];
};

type TrendingHashtag = {
  id: number;
  name: string;
  count: number;
};

export default function SocialFeedPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [showPostForm, setShowPostForm] = useState(false);
  const [newPost, setNewPost] = useState({
    content: "",
    type: "insight" as const,
    pollOptions: ["", ""],
    hashtags: [] as string[],
    isPinned: false,
  });
  const [newHashtag, setNewHashtag] = useState("");

  const { data: posts = [], isLoading: isLoadingPosts } = useQuery<
    ExtendedPost[]
  >({
    queryKey: ["/api/posts"],
  });

  const { data: trendingHashtags = [], isLoading: isLoadingTrends } = useQuery<
    TrendingHashtag[]
  >({
    queryKey: ["/api/hashtags/trending"],
  });

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    try {
      const filteredPollOptions =
        newPost.type === "poll" ? newPost.pollOptions.filter(Boolean) : [];

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...newPost,
          pollOptions: filteredPollOptions,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setNewPost({
        content: "",
        type: "insight",
        pollOptions: ["", ""],
        hashtags: [],
        isPinned: false,
      });
      setShowPostForm(false);
      queryClient.invalidateQueries({queryKey: ["/api/posts"]})
      queryClient.invalidateQueries({queryKey: ["/api/hashtags/trending"]})
      toast({
        title: "Success",
        description: "Post created successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create post",
      });
    }
  }

  function addHashtag(e: React.KeyboardEvent) {
    if (e.key === "Enter" && newHashtag.trim()) {
      e.preventDefault();
      const tag = newHashtag.startsWith("#") ? newHashtag.slice(1) : newHashtag;
      if (!newPost.hashtags.includes(tag)) {
        setNewPost((prev) => ({
          ...prev,
          hashtags: [...prev.hashtags, tag],
        }));
      }
      setNewHashtag("");
    }
  }

  function removeHashtag(tag: string) {
    setNewPost((prev) => ({
      ...prev,
      hashtags: prev.hashtags.filter((t) => t !== tag),
    }));
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            <Button
              onClick={() => setShowPostForm(!showPostForm)}
              variant="outline"
              className="w-full flex items-center justify-between py-6 text-left"
            >
              <span className="text-muted-foreground">
                {showPostForm ? "Hide post form" : "What's on your mind?"}
              </span>
              {showPostForm ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {showPostForm && (
              <Card className="transition-all duration-300 ease-in-out">
                <CardHeader className="border-b border-border/5 pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Share Your Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleCreatePost} className="space-y-6">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Post Type</Label>
                      <RadioGroup
                        value={newPost.type}
                        onValueChange={(value: typeof newPost.type) =>
                          setNewPost((prev) => ({ ...prev, type: value }))
                        }
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-auto gap-3"
                      >
                        {[
                          { value: "insight", label: "Insight" },
                          { value: "poll", label: "Poll" },
                          { value: "milestone", label: "Milestone" },
                          { value: "announcement", label: "Announcement" },
                        ].map(({ value, label }) => (
                          <div
                            key={value}
                            className="flex  items-center space-x-2 rounded-lg border border-border/40 p-2.5 transition-colors hover:bg-muted/50"
                          >
                            <RadioGroupItem
                              value={value}
                              id={value}
                              className="data-[state=checked]:border-primary"
                            />
                            <Label
                              htmlFor={value}
                              className="cursor-pointer text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                            >
                              {label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Textarea
                        placeholder="Share your thoughts, experiences, or insights..."
                        value={newPost.content}
                        onChange={(e) =>
                          setNewPost((prev) => ({
                            ...prev,
                            content: e.target.value,
                          }))
                        }
                        className="min-h-[120px] resize-none transition-colors focus:border-primary"
                      />
                    </div>

                    {newPost.type === "poll" && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          Poll Options
                        </Label>
                        <div className="space-y-2">
                          {newPost.pollOptions.map((option, index) => (
                            <Input
                              key={index}
                              placeholder={`Option ${index + 1}`}
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...newPost.pollOptions];
                                newOptions[index] = e.target.value;
                              
                                if (
                                  index === newOptions.length - 1 &&
                                  e.target.value &&
                                  newOptions.length < 5
                                ) {
                                  newOptions.push("");
                                }
                              
                                setNewPost((prev) => ({
                                  ...prev,
                                  pollOptions: newOptions,
                                }));
                              }}
                              
                              className="transition-colors focus:border-primary"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Hashtags</Label>
                      <div className="space-y-2">
                        <Input
                          placeholder="Add hashtags (press Enter)"
                          value={newHashtag}
                          onChange={(e) => setNewHashtag(e.target.value)}
                          onKeyDown={addHashtag}
                          className="transition-colors focus:border-primary"
                        />
                        {newPost.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {newPost.hashtags.map((tag) => (
                              <Button
                                key={tag}
                                variant="secondary"
                                size="sm"
                                onClick={() => removeHashtag(tag)}
                                className="group hover:bg-destructive/10"
                              >
                                <Hash className="mr-1 h-3 w-3" />
                                {tag}
                                <span className="ml-1 opacity-60 group-hover:opacity-100">
                                  ×
                                </span>
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {user?.role === "admin" && (
                      <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">
                            Pin Post
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Pinned posts will appear at the top of the feed
                          </p>
                        </div>
                        <Switch
                          checked={newPost.isPinned}
                          onCheckedChange={(checked) =>
                            setNewPost((prev) => ({
                              ...prev,
                              isPinned: checked,
                            }))
                          }
                          className="data-[state=checked]:bg-green-400"
                        />
                      </div>
                    )}
                    <Button type="submit" className="w-full">
                      Post
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {isLoadingPosts ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : posts.length > 0 ? (
              <div className="space-y-4">
                {posts
                  .sort((a, b) => {
                    // Sort by pinned status first (pinned first), then by updatedAt
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    return (
                      new Date(b.updatedAt).getTime() -
                      new Date(a.updatedAt).getTime()
                    );
                  })
                  .map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUserId={user!.id}
                    />
                  ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No posts yet. Be the first to share!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className="h-fit sticky top-6 transition-shadow duration-200 hover:shadow-md">
              <CardHeader className="border-b border-border/5 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Trending Topics
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoadingTrends ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : trendingHashtags.length > 0 ? (
                  <div className="space-y-3">
                    {trendingHashtags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-muted/50 cursor-pointer"
                      >
                        <Hash className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{tag.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {tag.count} posts
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No trending topics yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
