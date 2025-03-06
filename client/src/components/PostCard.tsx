import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Heart, Loader2, MessageSquare, PinIcon, PinOffIcon, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Post, PostComment, Profile, User } from "@/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

type ExtendedPost = Post & {
  author: User & { profile: Profile };
  likes: { userId: number }[];
  comments: (PostComment & {
    author: User & { profile: Profile },
    likes: { userId: number }[]
  })[];
};

interface PostCardProps {
  post: ExtendedPost;
  currentUserId: number;
  user?: User & { isAdmin: boolean };
}

type DeleteCommentResponse = {
  success: boolean;
  message: string;
  commentId?: number;
};

export function PostCard({ post, currentUserId, user }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showDeleteCommentAlert, setShowDeleteCommentAlert] = useState<number | null>(null);
  const [showDeletePostAlert, setShowDeletePostAlert] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: loggedInUser } = useUser()

  const deletePostMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(errorData.message || 'Failed to delete post');
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to delete post');
      }

      return data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['/api/posts'] });
      const previousPosts = queryClient.getQueryData<ExtendedPost[]>(['/api/posts']);

      queryClient.setQueryData<ExtendedPost[]>(['/api/posts'], (old) => {
        if (!old) return [];
        return old.filter(p => p.id !== post.id);
      });

      return { previousPosts };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      toast({
        title: "Success",
        description: data.message || "Post deleted successfully",
      });
      setShowDeletePostAlert(false);
    },
    onError: (error: Error, _, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(['/api/posts'], context.previousPosts);
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete post",
      });
      setShowDeletePostAlert(false);
    }
  });

  const deleteCommentMutation = useMutation<DeleteCommentResponse, Error, number>({
    mutationFn: async (commentId: number) => {
      const res = await fetch(`/api/posts/${post.id}/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to delete comment');
      }

      return res.json();
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ['/api/posts'] });
      const previousPosts = queryClient.getQueryData<ExtendedPost[]>(['/api/posts']);

      queryClient.setQueryData<ExtendedPost[]>(['/api/posts'], (old) => {
        if (!old) return [];
        return old.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              comments: p.comments.filter(c => c.id !== commentId)
            };
          }
          return p;
        });
      });

      return { previousPosts };
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      toast({
        title: "Success",
        description: response.message || "Comment deleted successfully",
      });
      setShowDeleteCommentAlert(null);
    },
    onError: (error, _, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(['/api/posts'], context.previousPosts);
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete comment",
      });
      setShowDeleteCommentAlert(null);
    }
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${post.id}/like`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['/api/posts'] });
      const previousPosts = queryClient.getQueryData<ExtendedPost[]>(['/api/posts']);

      queryClient.setQueryData<ExtendedPost[]>(['/api/posts'], (old) => {
        if (!old) return [];
        return old.map(p => {
          if (p.id === post.id) {
            const isLiked = p.likes.some(like => like.userId === currentUserId);
            return {
              ...p,
              likes: isLiked
                ? p.likes.filter(like => like.userId !== currentUserId)
                : [...p.likes, { userId: currentUserId }]
            };
          }
          return p;
        });
      });

      return { previousPosts };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
    },
    onError: (error: Error, _, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(['/api/posts'], context.previousPosts);
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to like post",
      });
    }
  });

  const commentLikeMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const res = await fetch(`/api/posts/${post.id}/comments/${commentId}/like`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ['/api/posts'] });
      const previousPosts = queryClient.getQueryData<ExtendedPost[]>(['/api/posts']);

      queryClient.setQueryData<ExtendedPost[]>(['/api/posts'], (old) => {
        if (!old) return [];
        return old.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              comments: p.comments.map(c => {
                if (c.id === commentId) {
                  // Ensure likes array exists before checking
                  const likes = c.likes || [];
                  const isLiked = likes.some(like => like.userId === currentUserId);
                  return {
                    ...c,
                    likes: isLiked
                      ? likes.filter(like => like.userId !== currentUserId)
                      : [...likes, { userId: currentUserId }]
                  };
                }
                return c;
              })
            };
          }
          return p;
        });
      });

      return { previousPosts };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
    },
    onError: (error: Error, _, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(['/api/posts'], context.previousPosts);
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to like comment",
      });
    }
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newComment })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  });

  const pinMutation = useMutation({
    mutationFn: async ({ postId, isPinned }: { postId: number; isPinned: boolean }) => {
      const res = await fetch(`/api/posts/${postId}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to pin/unpin post",
      });
    }
  });

  const handlePinToggle = (postId: number, isPinned: boolean) => {
    pinMutation.mutate({ postId, isPinned });
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'Unknown date';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  const isLiked = post.likes.some(like => like.userId === currentUserId);
  const isAuthor = post.author.id === currentUserId;

  return (
    <>
      <Card className="transition-shadow duration-200 hover:shadow-md overflow-hidden relative">
        <CardHeader className="pb-3 space-y-0">
          <div className="flex items-start justify-between">
            <Link href={`/profile/${post.author.id}`} className="flex items-center space-x-4 group">
              <Avatar className="h-10 w-10 border-2 border-primary/10 transition-transform group-hover:scale-105">
                {post.author.profile?.avatarUrl && (
                  <AvatarImage
                    src={post.author.profile.avatarUrl}
                    alt={post.author.profile?.name || post.author.username}
                  />
                )}
                <AvatarFallback className="bg-primary/5 text-primary">
                  {(post.author.profile?.name?.[0] || post.author.username[0]).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium leading-none group-hover:text-primary transition-colors">
                  {post.author.profile?.name || post.author.username}
                </p>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <time dateTime={post.createdAt?.toString() || ''}>
                    {formatDate(post.createdAt)}
                  </time>
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {post.type}
              </Badge>
              {(isAuthor || loggedInUser?.role === 'admin') && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setShowDeletePostAlert(true)}
                    disabled={deletePostMutation.isPending}
                  >
                    {deletePostMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                  {loggedInUser?.role === 'admin' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePinToggle(post.id, !post.isPinned)}
                      disabled={pinMutation.isPending}
                    >
                      {post.isPinned ? (
                        <PinIcon className="h-4 w-4 fill-primary text-primary" />
                      ) : (
                        <PinOffIcon className="h-4 w-4 text-muted-foreground hover:text-primary" />
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap mb-6 text-[15px] leading-relaxed">
            {post.content}
          </p>

          <div className="flex items-center justify-between border-t border-border/5 pt-4 mt-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="group space-x-2"
                onClick={() => likeMutation.mutate()}
                disabled={likeMutation.isPending}
              >
                <Heart
                  className={`h-4 w-4 transition-colors ${isLiked ? 'fill-primary text-primary' : 'group-hover:text-primary'
                    }`}
                />
                <span>{post.likes.length}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="group space-x-2"
                onClick={() => setShowComments(!showComments)}
              >
                <MessageSquare className="h-4 w-4 group-hover:text-primary" />
                <span>{post.comments.length}</span>
              </Button>
            </div>
          </div>

          {showComments && (
            <div className="space-y-4 border-t border-border/5 pt-4 mt-4">
              <div className="space-y-4">
                {post.comments.map((comment) => {
                  const isCommentAuthor = comment.author.id === currentUserId;
                  const commentAuthorName = comment.author.profile?.name || comment.author.username;
                  const commentLikes = comment.likes || [];
                  const isCommentLiked = commentLikes.some(like => like.userId === currentUserId);

                  return (
                    <div key={comment.id} className="flex items-start space-x-4">
                      <Link href={`/profile/${comment.author.id}`} className="group">
                        <Avatar className="h-8 w-8 border border-primary/10 transition-transform group-hover:scale-105">
                          {comment.author.profile?.avatarUrl && (
                            <AvatarImage
                              src={comment.author.profile.avatarUrl}
                              alt={commentAuthorName}
                            />
                          )}
                          <AvatarFallback className="bg-primary/5 text-primary text-xs">
                            {commentAuthorName[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <Link href={`/profile/${comment.author.id}`} className="group">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium group-hover:text-primary transition-colors">
                                {commentAuthorName}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(comment.createdAt)}
                              </span>
                            </div>
                          </Link>
                          {(isCommentAuthor || loggedInUser.role === 'admin') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => setShowDeleteCommentAlert(comment.id)}
                              disabled={deleteCommentMutation.isPending && showDeleteCommentAlert === comment.id}
                            >
                              {deleteCommentMutation.isPending && showDeleteCommentAlert === comment.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                        <p className="text-sm mt-1">{comment.content}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="group space-x-2 mt-1"
                          onClick={() => commentLikeMutation.mutate(comment.id)}
                          disabled={commentLikeMutation.isPending}
                        >
                          <Heart
                            className={`h-3 w-3 transition-colors ${isCommentLiked ? 'fill-primary text-primary' : 'group-hover:text-primary'
                              }`}
                          />
                          <span className="text-xs">{commentLikes.length}</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-start space-x-4">
                <Avatar className="h-8 w-8 border border-primary/10">
                  <AvatarFallback className="bg-primary/5 text-primary text-xs">
                    {(post.author.profile?.name || post.author.username)[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Textarea
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[80px] resize-none transition-colors focus:border-primary"
                  />
                  <Button
                    onClick={() => commentMutation.mutate()}
                    disabled={!newComment.trim() || commentMutation.isPending}
                    className="w-full"
                  >
                    {commentMutation.isPending ? "Posting..." : "Post Comment"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={showDeletePostAlert}
        onOpenChange={setShowDeletePostAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePostMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePostMutation.isPending}
            >
              {deletePostMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={showDeleteCommentAlert !== null}
        onOpenChange={() => setShowDeleteCommentAlert(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (showDeleteCommentAlert !== null) {
                  deleteCommentMutation.mutate(showDeleteCommentAlert);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCommentMutation.isPending}
            >
              {deleteCommentMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}