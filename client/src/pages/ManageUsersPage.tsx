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
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Lock,
  LockOpen,
  MoreVertical,
  Search,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type User = {
  id: number;
  username: string;
  role: string;
  status: "active" | "pending" | "banned" | "approved" | "rejected";
  createdAt: string;
  tier: "free" | "premium";
  profile: {
    name: string;
    email: string;
    company?: string;
    university?: string;
  };
  ban?: {
    reason?: string;
    bannedAt?: string;
  };
};

type PaginationInfo = {
  total: number;
  pages: number;
  currentPage: number;
  perPage: number;
};

type UserAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant: "default" | "destructive" | "outline" | "secondary";
  action: "ban" | "unban" | "upgrade" | "downgrade" | "approve" | "reject";
  requiresConfirmation: boolean;
  confirmationMessage?: string;
};

const getUserActions = (user: User): UserAction[] => {
  const actions: UserAction[] = [];

  // Status-based actions (Ban/Unban)
  if (user.status === "banned") {
    actions.push({
      id: "unban",
      label: "Unban User",
      icon: <LockOpen className="h-4 w-4" />,
      variant: "secondary",
      action: "unban",
      requiresConfirmation: true,
      confirmationMessage: "Are you sure you want to unban this user?",
    });
  } else {
    actions.push({
      id: "ban",
      label: "Ban User",
      icon: <Lock className="h-4 w-4" />,
      variant: "destructive",
      action: "ban",
      requiresConfirmation: true,
      confirmationMessage: "Are you sure you want to ban this user?",
    });
  }

  // Tier-based actions
  if (user.tier === "free") {
    actions.push({
      id: "upgrade",
      label: "Upgrade to Premium",
      icon: <ArrowUp className="h-4 w-4" />,
      variant: "default",
      action: "upgrade",
      requiresConfirmation: true,
      confirmationMessage: "Upgrade user to premium tier?",
    });
  } else {
    actions.push({
      id: "downgrade",
      label: "Downgrade to Free",
      icon: <ArrowDown className="h-4 w-4" />,
      variant: "secondary",
      action: "downgrade",
      requiresConfirmation: true,
      confirmationMessage: "Downgrade user to free tier?",
    });
  }

  // Approval actions for pending users
  if (user.status === "pending") {
    actions.push({
      id: "approve",
      label: "Approve User",
      icon: <Check className="h-4 w-4" />,
      variant: "default",
      action: "approve",
      requiresConfirmation: true,
      confirmationMessage: "Approve this user account?",
    });
    actions.push({
      id: "reject",
      label: "Reject User",
      icon: <X className="h-4 w-4" />,
      variant: "destructive",
      action: "reject",
      requiresConfirmation: true,
      confirmationMessage: "Reject and delete this user account?",
    });
  }

  return actions;
};

const getStatusBadgeVariant = (status: User["status"]) => {
  switch (status) {
    case "active":
      return "success";
    case "pending":
      return "warning";
    case "banned":
      return "destructive";
    case "approved":
      return "success";
    default:
      return "secondary";
  }
};

const getTierBadgeVariant = (tier: User["tier"]) => {
  switch (tier) {
    case "premium":
      return "primary";
    case "free":
      return "secondary";
    default:
      return "secondary";
  }
};

export default function ManageUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string | undefined>(undefined);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<UserAction | null>(null);
  const [actionReason, setActionReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/users", { page, search, role }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });

      if (search) params.append("search", search);
      if (role) params.append("role", role);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        users: User[];
        pagination: PaginationInfo;
      }>;
    },
  });

  const executeAction = useMutation({
    mutationFn: async ({
      userId,
      action,
      data,
    }: {
      userId: string;
      action: string;
      data?: any;
    }) => {
      const response = await fetch(`/api/admin/users/${userId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: `User ${currentAction?.label.toLowerCase()} successfully`,
      });
      setActionDialogOpen(false);
      setSelectedUser(null);
      setCurrentAction(null);
      setActionReason("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleAction = (user: User, action: UserAction) => {
    setSelectedUser(user);
    setCurrentAction(action);

    if (action.action === "ban") {
      setActionDialogOpen(true);
      return;
    }

    const actionData: Record<string, any> = {};

    switch (action.action) {
      case "ban":
        actionData.reason = actionReason;
        executeAction.mutate({
          userId: user.id.toString(),
          action: "ban",
          data: actionData,
        });
        break;
      case "unban":
        executeAction.mutate({
          userId: user.id.toString(),
          action: "unban",
        });
        break;
      case "upgrade":
        executeAction.mutate({
          userId: user.id.toString(),
          action: "tier",
          data: { tier: "premium" },
        });
        break;
      case "downgrade":
        executeAction.mutate({
          userId: user.id.toString(),
          action: "tier",
          data: { tier: "free" },
        });
        break;
      case "approve":
        executeAction.mutate({
          userId: user.id.toString(),
          action: "approve",
          data: { status: "approved" },
        });
        break;
      case "reject":
        executeAction.mutate({
          userId: user.id.toString(),
          action: "reject",
          data: { status: "rejected" },
        });
        break;
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Users</h1>
        <div className="flex gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={role || "all"} onValueChange={setRole}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="company">Company</SelectItem>
              <SelectItem value="vc">VC</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Company/University</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : (
              data?.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {user.profile?.name || user.username}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{user.role}</TableCell>
                  <TableCell>
                    <Badge
                      variant={getTierBadgeVariant(user.tier)}
                      className="capitalize"
                    >
                      {user.tier === "premium" ? "Paid" : "Free"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.profile?.company || user.profile?.university || "-"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getStatusBadgeVariant(user.status)}
                      className="capitalize"
                    >
                      {user.status === "active" ? "Approved" : user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {getUserActions(user).map((action) => (
                          <DropdownMenuItem
                            key={action.id}
                            onClick={() => handleAction(user, action)}
                          >
                            {action.icon}
                            <span className="ml-2">{action.label}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {data && (
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * 10 + 1} to{" "}
              {Math.min(page * 10, data.pagination.total)} of{" "}
              {data.pagination.total} users
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.pagination.pages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentAction?.label}</DialogTitle>
            <DialogDescription>
              {currentAction?.confirmationMessage}
            </DialogDescription>
          </DialogHeader>
          {currentAction?.action === "ban" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Reason for ban</Label>
                <Textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Enter reason for banning this user"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDialogOpen(false);
                setSelectedUser(null);
                setCurrentAction(null);
                setActionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant={currentAction?.variant || "default"}
              onClick={() => {
                if (selectedUser && currentAction?.action === "ban") {
                  executeAction.mutate({
                    userId: selectedUser.id.toString(),
                    action: "ban",
                    data: { reason: actionReason },
                  });
                }
              }}
              disabled={
                executeAction.isPending ||
                (currentAction?.action === "ban" && !actionReason)
              }
            >
              {executeAction.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                currentAction?.icon
              )}
              {currentAction?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
