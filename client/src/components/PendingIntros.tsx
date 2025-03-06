// client/src/components/PendingIntros.tsx

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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EllipsisVerticalIcon, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  name: string;
  avatarUrl: string;
  id: number;
}

interface Intro {
  id: number;
  profile: Profile;
}

const respondToIntro = async ({
  id,
  status,
}: {
  id: number;
  status: string;
}) => {
  const response = await fetch(`/api/intros/respond`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, status }),
  });
  if (!response.ok) {
    throw new Error("Failed to respond to intro");
  }
  return response.json();
};

const PendingIntros = ({ pendingIntros = [] }: { pendingIntros: Intro[] }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedIntro, setSelectedIntro] = useState<Intro | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: respondToIntro,
    onSuccess: (data,variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/intros/pending"] });
      setSelectedIntro(null);
      setAction(null);
      setIsAlertOpen(false);
      setIsDropdownOpen(false);
      toast({
        title: "Intro Request",
        description: `Intro Request has been ${variables.status} successfully.`,
      });
    },
    onError:(error)=>{
        toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
    }
  });

  const handleAction = (intro: Intro, actionType: string) => {
    setSelectedIntro(intro);
    setAction(actionType);
    setIsAlertOpen(true);
    setIsDropdownOpen(false);
  };

  const resetStates = () => {
    setSelectedIntro(null);
    setAction(null);
    setIsAlertOpen(false);
    setIsDropdownOpen(false);
  };

  return (
    <div className="border p-4 rounded-lg">
      <h2 className="text-2xl font-semibold mb-4">Pending Intro Requests</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white text-left">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Avatar</th>
              <th className="py-2 px-4 border-b">Name</th>
              <th className="py-2 px-4 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingIntros.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-4">
                  No pending intro requests.
                </td>
              </tr>
            ) : (
              pendingIntros.map((intro) => (
                <tr
                  key={intro.id}
                  className="hover:bg-gray-100 cursor-pointer"
                  onClick={() => setLocation(`/profile/${intro.profile.id}`)}
                >
                     
                  <td className="py-2 px-4 border-b"  >
                    <img
                      src={intro.profile.avatarUrl}
                      alt={intro.profile.name}
                      className="w-10 h-10 rounded-full"
                    />
                  </td>
                  <td className="py-2 text-left px-4 border-b">
                    {intro.profile.name}
                  </td>
                  <td className="py-2 px-4 border-b text-right">
                    <DropdownMenu 
                      open={isDropdownOpen} 
                      onOpenChange={setIsDropdownOpen}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          className="text-gray-500 hover:text-gray-700 font-bold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EllipsisVerticalIcon className="w-6 h-6" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAction(intro, "accepted");
                          }}
                        >
                          Accept
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAction(intro, "rejected");
                          }}
                        >
                          Reject
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog 
        open={isAlertOpen} 
        onOpenChange={(open) => {
          if (!open) {
            resetStates();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {action} the intro request from{" "}
              {selectedIntro?.profile.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetStates}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedIntro && action) {
                  mutation.mutate({ 
                    id: selectedIntro.id, 
                    status: action 
                  });
                }
              }}
              disabled={mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {action === "accepted" ? "Accept" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PendingIntros;
