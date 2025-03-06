import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Pencil, Trash } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Job } from "@/db/schema";
import { Label } from "@/components/ui/label";
import { QuickApplyDialog } from "./QuickApplyDialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Helper function to format job type
const formatJobType = (type: string): string => {
  const words = type.split('_');
  return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

// Rest of the imports and type definitions remain unchanged...

type JobFormData = z.infer<typeof jobSchema>;

type JobWithCompany = Job & {
  company?: {
    name: string;
  };
};

type JobCardProps = {
  job: JobWithCompany;
  showApply?: boolean;
  showDelete?: boolean;
  onDelete?: () => void;
  applicationStatus?: string;
};

export function JobCard({ 
  job, 
  showApply = true, 
  showDelete = false, 
  onDelete,
  applicationStatus 
}: JobCardProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: job.title,
      description: job.description,
      requirements: job.requirements?.join('\n') || '',
      location: job.location,
      type: job.type,
      internshipType: job.internshipType,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      isRemote: job.isRemote || false,
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setEditDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setDeleteDialogOpen(false);
    },
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold">{job.title}</CardTitle>
            <p className="text-sm text-muted-foreground">Posted by: <strong >{job.company?.profile.company}</strong></p>
            {job.company && (
              <CardDescription className="mt-1">{job.company.name}</CardDescription>
            )}
            {applicationStatus && (
              <Badge variant="outline" className="mt-2">
                Status: {applicationStatus}
              </Badge>
            )}
          </div>
          <Badge variant="secondary">{formatJobType(job.type)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{job.description}</p>

        {job.requirements && (
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Requirements</h4>
            <ul className="list-disc list-inside text-sm">
              {job.requirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{job.location}</Badge>
            {job.isRemote && <Badge variant="outline">Remote</Badge>}
          </div>

          <div className="flex items-center gap-2">
            {user?.id === job.userId && showDelete && (
              <>
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90%] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Edit Job Posting</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(data => updateMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Job Title</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea {...field} className="min-h-[100px]" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="requirements"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Requirements (one per line)</FormLabel>
                              <FormControl>
                                <Textarea {...field} className="min-h-[100px]" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Job Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select job type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="full_time">Full Time</SelectItem>
                                  <SelectItem value="part_time">Part Time</SelectItem>
                                  <SelectItem value="internship">Internship</SelectItem>
                                  <SelectItem value="contract">Contract</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="isRemote">Remote Work</Label>
                            <FormField
                              control={form.control}
                              name="isRemote"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      id="isRemote"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="salaryMin"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Min Salary (optional)</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="number" value={field.value ?? ''} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="salaryMax"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Max Salary (optional)</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="number" value={field.value ?? ''} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            "Update Job"
                          )}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>

                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon">
                      <Trash className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Job Posting</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this job posting? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Delete"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {showApply && user?.role === 'student' && !applicationStatus && (
              <QuickApplyDialog job={job} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const jobSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  requirements: z.string().transform(str => str ? str.split('\n').filter(Boolean) : []),
  location: z.string().min(1, "Location is required"),
  type: z.enum(['full_time', 'part_time', 'internship', 'contract']),
  internshipType: z.enum(['paid', 'unpaid', 'not_applicable']).default('not_applicable'),
  salaryMin: z.coerce.number().nullable(),
  salaryMax: z.coerce.number().nullable(),
  isRemote: z.boolean().default(false),
});