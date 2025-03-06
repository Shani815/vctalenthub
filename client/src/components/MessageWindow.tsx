import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, MessageCircle, Send, X } from "lucide-react";
import type { Profile, User } from "@/db/schema";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

type Message = {
  id: number;
  content: string;
  fromUserId: number;
  toUserId: number;
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
  fromUser: {
    username: string;
    profile?: Profile;
  };
};

type Connection = {
  user: User & {
    profile?: Profile;
  };
  lastMessage?: Message;
  unreadCount: number;
};

export function MessageWindow() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: number; name: string } | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get list of connections with unread messages
  const { data: connections, isLoading: connectionsLoading } = useQuery<Connection[]>({
    queryKey: ["/api/messages/connections"],
    enabled: isOpen && !!user,
  });

  // Get messages for selected user
  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: [`/api/messages/${selectedUser?.id}`, selectedUser?.id],
    enabled: !!selectedUser && !!user,
    refetchInterval: 5000, // Poll every 5 seconds for new messages
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedUser) return;

      const res = await fetch(`/api/messages/${selectedUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: (newMessage) => {
      setMessageInput("");
      // Update the messages cache optimistically
      queryClient.setQueryData<Message[]>([`/api/messages/${selectedUser?.id}`, selectedUser?.id], (oldMessages) => {
        if (!oldMessages) return [newMessage];
        return [...oldMessages, newMessage];
      });
      // Invalidate queries to ensure consistent state
      queryClient.invalidateQueries({ queryKey: [`/api/messages/${selectedUser?.id}`, selectedUser?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/connections"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to send message",
        description: error.message,
      });
    },
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!user) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate(messageInput);
  };

  // Helper function to get initials from name
  const getInitials = (name?: string) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase();
  };

  // Helper function to format message timestamp
  const formatMessageTime = (date: string) => {
    const messageDate = new Date(date);
    const now = new Date();

    if (messageDate.toDateString() === now.toDateString()) {
      return format(messageDate, 'h:mm a');
    }

    if (now.getFullYear() === messageDate.getFullYear()) {
      return format(messageDate, 'MMM d');
    }

    return format(messageDate, 'MM/dd/yy');
  };

  // Helper function to render message status
  const renderMessageStatus = (status: Message['status']) => {
    switch (status) {
      case 'sent':
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case 'delivered':
        return (
          <div className="flex">
            <Check className="h-3 w-3 text-primary" />
            <Check className="h-3 w-3 -ml-1 text-primary" />
          </div>
        );
      case 'read':
        return (
          <div className="flex text-blue-500">
            <Check className="h-3 w-3" />
            <Check className="h-3 w-3 -ml-1" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg relative"
        >
          <MessageCircle className="h-6 w-6" />
          {connections?.some(conn => conn.unreadCount > 0) && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full" />
          )}
        </Button>
      ) : (
        <Card className="w-80">
          <CardHeader className="p-3 flex flex-row items-center space-y-0">
            <CardTitle className="text-sm flex-1">Messages</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setIsOpen(false);
                setSelectedUser(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {!selectedUser ? (
              <ScrollArea className="h-96">
                {connectionsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : connections?.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No connections yet. Connect with others to start messaging!
                  </div>
                ) : (
                  connections?.map(({ user: connection, lastMessage, unreadCount }) => (
                    <Button
                      key={connection.id}
                      variant="ghost"
                      className="w-full justify-start px-3 py-2 h-auto relative"
                      onClick={() => setSelectedUser({
                        id: connection.id,
                        name: connection.profile?.name || connection.username
                      })}
                    >
                      <Avatar className="h-8 w-8 mr-2">
                        {connection.profile?.avatarUrl && (
                          <AvatarImage src={connection.profile.avatarUrl} />
                        )}
                        <AvatarFallback>
                          {getInitials(connection.profile?.name || connection.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">
                            {connection.profile?.name || connection.username}
                          </span>
                          {lastMessage && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {formatMessageTime(lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {lastMessage && (
                            <p className="text-xs text-muted-foreground truncate">
                              {lastMessage.fromUserId === user.id ? 'You: ' : ''}{lastMessage.content}
                            </p>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <span className="absolute bottom-2 right-3 h-4 w-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </Button>
                  ))
                )}
              </ScrollArea>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-start px-3 py-2"
                  onClick={() => setSelectedUser(null)}
                >
                  ← Back to conversations
                </Button>
                <div className="border-t">
                  <ScrollArea className="h-72" ref={scrollRef}>
                    <div className="flex flex-col gap-2 p-3">
                      {messagesLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : messages?.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground py-4">
                          No messages yet. Start the conversation!
                        </div>
                      ) : (
                        messages?.map((message) => (
                          <div
                            key={message.id}
                            className={`flex gap-2 ${
                              message.fromUserId === user.id ? "flex-row-reverse" : ""
                            }`}
                          >
                            <Avatar className="h-8 w-8">
                              {message.fromUser.profile?.avatarUrl && (
                                <AvatarImage src={message.fromUser.profile.avatarUrl} />
                              )}
                              <AvatarFallback>
                                {getInitials(message.fromUser.profile?.name || message.fromUser.username)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="max-w-[200px]">
                              <div
                                className={`rounded-lg px-3 py-2 ${
                                  message.fromUserId === user.id
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                                }`}
                              >
                                {message.content}
                              </div>
                              {message.fromUserId === user.id && (
                                <div className="flex justify-end mt-0.5">
                                  {renderMessageStatus(message.status)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  <form onSubmit={handleSend} className="border-t p-3 flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1"
                      disabled={sendMessageMutation.isPending}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={sendMessageMutation.isPending}
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}