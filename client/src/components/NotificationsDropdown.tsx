import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type ConnectionRequest = {
  id: number;
  fromUser: {
    id: number;
    username: string;
    profile: {
      name: string;
      avatarUrl: string | null;
    } | null;
  };
  type: "pending";
  createdAt: string;
};

export function NotificationsDropdown() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { toast } = useToast();

  const { data: requests } = useQuery<ConnectionRequest[]>({
    queryKey: ["/api/network/requests"],
    enabled: isOpen, // Only fetch when dropdown is open
  });

  const responseMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
    }: {
      requestId: number;
      status: "connected" | "rejected";
    }) => {
      const res = await fetch(`/api/network/requests/${requestId}/response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/network"] });
      queryClient.invalidateQueries({ queryKey: ["/api/network/requests"] });
      toast({
        title: "Success",
        description: `Request ${
          variables.status === "connected" ? "accepted" : "rejected"
        } successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  useEffect(() => {
    setPendingCount(requests?.length ?? 0);
  }, [requests]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {pendingCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0"
              variant="destructive"
            >
              {pendingCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {!requests?.length ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No new notifications
          </div>
        ) : (
          requests.map((request) => (
            <DropdownMenuItem
              key={request.id}
              className="flex flex-col items-start justify-start p-4"
            >
              <div className="flex gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={request.fromUser.profile?.avatarUrl ?? undefined}
                  />
                  <AvatarFallback>
                    {request.fromUser.profile?.name?.charAt(0) ??
                      request.fromUser.username.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {request.fromUser.profile?.name ??
                      request.fromUser.username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sent you a connection request
                  </p>
                </div>
              </div>
              <div className="flex gap-4 items-end justify-end w-full">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    responseMutation.mutate({
                      requestId: request.id,
                      status: "rejected",
                    })
                  }
                  disabled={responseMutation.isPending}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    responseMutation.mutate({
                      requestId: request.id,
                      status: "connected",
                    });
                  }}
                  disabled={responseMutation.isPending}
                >
                  Accept
                </Button>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
