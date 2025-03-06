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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, MoreVertical, Pencil, RefreshCcw, Search, SearchIcon, Trash } from "lucide-react";
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
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobForm } from "@/components/JobForm";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Job = {
  id: number;
  title: string;
  description: string;
  type: "full_time" | "part_time" | "internship" | "contract";
  location: string;
  salaryMin: number;
  salaryMax: number;
  isRemote: boolean;
  createdAt: string;
  user: {
    id: number;
    username: string;
    profile: {
      name: string | null;
      email: string | null;
    };
  };
};

export default function ManageJobsPage() {
  const [uiFilters, setUIFilters] = useState({
    type: "all",
    internshipType: "all",
    salaryRange: [0, 200000],
    isRemote: false,
    search: "",
  });

  // Separate state for debounced API filters
  const [apiFilters, setAPIFilters] = useState(uiFilters);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);

  // Debounce API filter updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setAPIFilters(uiFilters);
    }, 300);

    return () => clearTimeout(timer);
  }, [uiFilters]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/jobs", apiFilters, page],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (apiFilters.type !== "all") {
        params.append('type', apiFilters.type);
      }

      if (apiFilters.internshipType !== "all") {
        params.append('internshipType', apiFilters.internshipType);
      }

      params.append('salaryMin', apiFilters.salaryRange[0].toString());
      params.append('salaryMax', apiFilters.salaryRange[1].toString());
      params.append('isRemote', apiFilters.isRemote.toString());
      params.append('page', page.toString());
      params.append('perPage', perPage.toString());

      if (apiFilters.search) {
        params.append('search', apiFilters.search);
      }

      const res = await fetch(`/api/admin/jobs?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ jobs: Job[]; pagination: { total: number; pages: number } }>;
    },
  });

  const deleteJob = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await fetch(`/api/admin/jobs/${jobId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({
        title: "Success",
        description: "Job deleted successfully",
      });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const updateJob = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/admin/jobs/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({
        title: "Success",
        description: "Job updated successfully",
      });
      setIsEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Update handlers
  const handleFilterChange = useCallback((key: string, value: any) => {
    setUIFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor all job postings across the platform
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] })}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="backdrop-blur-sm bg-card/50 border-muted/30">
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Job Type</Label>
              <Select
                value={uiFilters.type}
                onValueChange={(value) => handleFilterChange('type', value)}
              >
                <SelectTrigger className="bg-background/50 backdrop-blur-sm">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Internship Type</Label>
              <Select
                value={uiFilters.internshipType}
                onValueChange={(value) => handleFilterChange('internshipType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Salary Range</Label>
              <Slider
                min={0}
                max={200000}
                step={10000}
                value={uiFilters.salaryRange}
                onValueChange={(value) => handleFilterChange('salaryRange', value)}
                className="py-4"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>${uiFilters.salaryRange[0].toLocaleString()}</span>
                <span>${uiFilters.salaryRange[1].toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="remote"
                  checked={uiFilters.isRemote}
                  onCheckedChange={(checked) => handleFilterChange('isRemote', checked)}
                />
                <Label htmlFor="remote">Remote Only</Label>
              </div>

              <div className="relative">
                <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs..."
                  value={uiFilters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-8 bg-background/50 backdrop-blur-sm"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-card/50 backdrop-blur-sm shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-muted/50">
              <TableHead className="w-[300px]">Job Details</TableHead>
              <TableHead className="w-[200px]">Posted By</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Salary Range</TableHead>
              <TableHead className="w-[100px]">Remote</TableHead>
              <TableHead className="w-[120px]">Posted Date</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : data?.jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No jobs found
                </TableCell>
              </TableRow>
            ) : (
              data?.jobs.map((job) => (
                <TableRow key={job.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium truncate max-w-[280px]">{job.title}</span>
                      <span className="text-sm text-muted-foreground truncate max-w-[280px]">
                        {job.description}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="truncate max-w-[180px]">{job.user.profile.name}</span>
                      <span className="text-sm text-muted-foreground truncate max-w-[180px]">
                        {job.user.profile.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className="whitespace-nowrap"
                    >
                      {job.type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="truncate max-w-[150px] block">{job.location}</span>
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap">
                      ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={job.isRemote ? "default" : "secondary"}
                      className="whitespace-nowrap"
                    >
                      {job.isRemote ? "Remote" : "On-site"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap">
                      {format(new Date(job.createdAt), "MMM d, yyyy")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-background/80">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedJob(job);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Job
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setSelectedJob(job);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete Job
                        </DropdownMenuItem>
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
              Showing {((page - 1) * perPage) + 1} to{" "}
              {Math.min(page * perPage, data.pagination.total)} of{" "}
              {data.pagination.total} jobs
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job</DialogTitle>
          </DialogHeader>
          {selectedJob && (
            <JobForm
              defaultValues={selectedJob}
              onSubmit={(data) => updateJob.mutate({ id: selectedJob.id, ...data })}
              isLoading={updateJob.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this job? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedJob && deleteJob.mutate(selectedJob.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 