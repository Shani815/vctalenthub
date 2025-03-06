import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Link, Loader2, Plus, Trash2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const getHighlightTypes = (userRole?: string) => {
  switch (userRole) {
    case 'venture_capitalist':
      return {
        latest_deals: "Latest Deals",
        cheque_sizes: "Cheque Sizes",
        exits_acquisitions: "Exits & Acquisitions",
        fund_milestones: "Fund Milestones",
        portfolio_wins: "Portfolio Wins",
        media_features: "Media Features"
      };
    case 'startup':
      return {
        fundraising_announcements: "Fundraising Announcements",
        product_launches: "Product Launches",
        revenue_growth: "Revenue & Growth",
        strategic_partnerships: "Strategic Partnerships",
        awards_recognition: "Awards & Recognition",
        media_features: "Media Features"
      };
    case 'student':
      return {
        projects: "Projects",
        research_papers: "Research Papers",
        internships: "Internship Experience",
        certifications: "Certifications",
        pitch_decks: "Pitch Decks",
        financial_models: "Financial Models",
        investment_memos: "Investment Memos",
        market_research_reports: "Market Research Reports",
        growth_strategy_documents: "Growth Strategy Documents",
        consulting_projects: "Consulting Projects",
        case_competitions: "Case Competition Submissions",
        previously_built_companies: "Previously Built Companies",
        other: "Other"
      };
    default:
      return {
        other: "Other"
      };
  }
};

const highlightFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.string({
    required_error: "Please select a highlight type",
  }),
  description: z.string().optional(),
  url: z.string()
    .url("Please enter a valid URL")
    .or(z.literal("")) // Allow empty string
    .optional(),
  file: z.instanceof(FileList, {
    message: "Please select a file",
  }).optional(),
}).refine(data => data.url || data.file, {
  message: "Enter either URL or File Upload is required",
  path: ["urlOrFile"]
});

type HighlightFormValues = z.infer<typeof highlightFormSchema>;

export default function HighlightsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteHighlightAlert, setShowDeleteHighlightAlert] = useState(null);

  const highlightTypes = getHighlightTypes(user?.role);

  const { data: highlights, isLoading } = useQuery({
    queryKey: ['/api/highlights'],
    queryFn: async () => {
      const response = await fetch('/api/highlights');
      if (!response.ok) throw new Error('Failed to fetch highlights');
      return response.json();
    },
  });

  const form = useForm<HighlightFormValues>({
    resolver: zodResolver(highlightFormSchema),
    defaultValues: {
      title: "",
      type: "",
      description: "",
      url: "",
      file: undefined
    }
  });

  const createHighlight = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch('/api/highlights', {
        method: 'POST',
        body: data,
      });
      if (!response.ok) throw new Error('Failed to create highlight');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/highlights'] });
      toast({
        title: "Success",
        description: "Your highlight has been added.",
      });
      form.reset();
      setIsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add highlight",
        variant: "destructive",
      });
    },
  });

  const deleteHighlight = useMutation({
    mutationFn: async (highlightId: number) => {
      const response = await fetch(`/api/highlights/${highlightId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete highlight');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/highlights'] });
      toast({
        title: "Success",
        description: "Highlight has been deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete highlight",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: HighlightFormValues) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('type', data.type);
    if (data.description) formData.append('description', data.description);
    if (data.url) formData.append('url', data.url);
    if (data.file && data.file.length > 0) {
      formData.append('file', data.file[0]);
    }

    createHighlight.mutate(formData);
  };

  useEffect(() => {
    // if urlorpath error exist then empty error after 2 seconds
    if (form.formState.errors?.urlOrFile) {
      setTimeout(() => {
        form.setError("urlOrFile", { message: "" });
      }, 2000);
    }
  }, [form.formState.errors]);

  return (
    <div className="container py-8 space-y-8 px-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Professional Highlights</h1>
          <p className="text-muted-foreground mt-1">
            Showcase your professional work samples and achievements
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Highlight
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90%] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Professional Highlight</DialogTitle>
              <DialogDescription>
                Upload documents and files to showcase your professional achievements.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter title" {...field} />
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
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(highlightTypes).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter a brief description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter URL" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { onChange, value, ...field } }) => (
                    <FormItem>
                      <FormLabel>File</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                          onChange={(e) => onChange(e.target.files)}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.formState.errors?.urlOrFile && <p className={"text-sm font-medium text-destructive"} >{form.formState.errors?.urlOrFile?.message}</p>}
                <Button type="submit" disabled={createHighlight.isPending}>
                  {createHighlight.isPending ? "Uploading..." : "Add Highlight"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-32 bg-muted" />
              <CardContent className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : highlights?.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <CardTitle>No highlights yet</CardTitle>
            <p className="text-muted-foreground">
              Start showcasing your professional work by adding your first highlight
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {highlights?.map((highlight: any) => (
            <Card key={highlight.id} className="group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="line-clamp-2">{highlight.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {highlightTypes[highlight.type as keyof typeof highlightTypes]}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteHighlightAlert(highlight.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4 " />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {highlight.description && (
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {highlight.description}
                  </p>
                )}
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AlertDialog
        open={showDeleteHighlightAlert !== null}
        onOpenChange={() => setShowDeleteHighlightAlert(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Highlight</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this highlight? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (showDeleteHighlightAlert !== null) {
                  deleteHighlight.mutate(showDeleteHighlightAlert);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteHighlight.isPending}
            >
              {deleteHighlight.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}