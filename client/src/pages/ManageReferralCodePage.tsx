import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ReferralCode {
  id: number;
  username: string;
  email: string;
  referralCode: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'banned';
  createdAt: string;
}

interface SuperReferralCode {
  id: number;
  code: string;
  isActive: boolean;
  createdAt: string;
}

export function ManageReferralCodePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");
  const [newSuperCode, setNewSuperCode] = useState("");

  // Query for regular referral codes
  const { data: referralCodes, isLoading: isLoadingReferralCodes } = useQuery<ReferralCode[]>({
    queryKey: ['/api/admin/referral-codes'],
    queryFn: async () => {
      const response = await fetch('/api/admin/referral-codes', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch referral codes');
      return response.json();
    }
  });

  // Query for super referral codes
  const { data: superReferralCodes, isLoading: isLoadingSuperCodes } = useQuery<SuperReferralCode[]>({
    queryKey: ['/api/admin/super-referral-codes'],
    queryFn: async () => {
      const response = await fetch('/api/admin/super-referral-codes', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch super referral codes');
      return response.json();
    }
  });

  // Mutation for regular referral codes
  const updateMutation = useMutation({
    mutationFn: async ({ userId, referralCode, status }: { userId: number; referralCode?: string; status?: string }) => {
      const response = await fetch('/api/admin/referral-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, referralCode, status }),
      });
      if (!response.ok) throw new Error('Failed to update referral code');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/referral-codes'] });
      toast({
        title: "Success",
        description: "Referral code updated successfully",
      });
      setEditingId(null);
      setNewCode("");
      setNewStatus("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for super referral codes
  const superCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await fetch('/api/admin/super-referral-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });
      if (!response.ok) throw new Error('Failed to create super referral code');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/super-referral-codes'] });
      toast({
        title: "Success",
        description: "Super referral code created successfully",
      });
      setNewSuperCode("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for toggling super referral code status
  const toggleSuperCodeMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await fetch(`/api/admin/super-referral-codes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error('Failed to update super referral code');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/super-referral-codes'] });
      toast({
        title: "Success",
        description: "Super referral code updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdate = (userId: number) => {
    updateMutation.mutate({
      userId,
      referralCode: newCode || undefined,
      status: newStatus || undefined
    });
  };

  const handleCreateSuperCode = () => {
    if (!newSuperCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a super referral code",
        variant: "destructive",
      });
      return;
    }
    superCodeMutation.mutate(newSuperCode);
  };

  if (isLoadingReferralCodes || isLoadingSuperCodes) {
    return  <div className="flex justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Referral Codes</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="regular">
          <TabsList>
            <TabsTrigger value="regular">Regular Referral Codes</TabsTrigger>
            <TabsTrigger value="super">Super Referral Codes</TabsTrigger>
          </TabsList>

          <TabsContent value="regular">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Referral Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referralCodes?.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell>{code.username}</TableCell>
                    <TableCell>{code.email}</TableCell>
                    <TableCell>
                      {editingId === code.id ? (
                        <Input
                          value={newCode}
                          onChange={(e) => setNewCode(e.target.value)}
                          placeholder="Enter new code"
                        />
                      ) : (
                        code.referralCode || "N/A"
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === code.id ? (
                        <Select
                          value={newStatus}
                          onValueChange={setNewStatus}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={
                          code.status === 'approved' ? 'text-green-600' :
                          code.status === 'pending' ? 'text-yellow-600' :
                          code.status === 'rejected' ? 'text-red-600' :
                          'text-gray-600'
                        }>
                          {code.status}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(code.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {editingId === code.id ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdate(code.id)}
                            disabled={updateMutation.isPending}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setNewCode("");
                              setNewStatus("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(code.id);
                            setNewCode(code.referralCode || "");
                            setNewStatus(code.status);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="super">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newSuperCode}
                  onChange={(e) => setNewSuperCode(e.target.value)}
                  placeholder="Enter new super referral code"
                />
                <Button onClick={handleCreateSuperCode} disabled={superCodeMutation.isPending}>
                  Create
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {superReferralCodes?.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell>{code.code}</TableCell>
                      <TableCell>
                        <span className={code.isActive ? 'text-green-600' : 'text-red-600'}>
                          {code.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(code.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleSuperCodeMutation.mutate({
                            id: code.id,
                            isActive: !code.isActive
                          })}
                        >
                          {code.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 