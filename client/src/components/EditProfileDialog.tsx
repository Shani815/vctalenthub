import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { GRADUATION_YEARS, PREDEFINED_INDUSTRIES, PREDEFINED_SKILLS, PREDEFINED_UNIVERSITIES } from "@/pages/DashboardPage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  companyProfileSchema,
  companySizeOptions,
  fundingSizeOptions,
} from "./CompanyProfileWizard";
import { graduationYears, studentProfileSchema } from "./StudentProfileWizard";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Profile } from "@/db/schema";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { IndustriesList } from "@/constants";
import MultiSelectField from "./ui/multi-select";

type EditProfileDialogProps = {
  profile: Profile;
  trigger?: React.ReactNode;
  isNewProfile?: boolean;
};

type StudentFormData = z.infer<typeof studentProfileSchema>;
type CompanyFormData = z.infer<typeof companyProfileSchema>;

export function EditProfileDialog({ profile, trigger, isNewProfile }: EditProfileDialogProps) {
  const { user } = useUser();
  if (!user) return null;

  const [open, setOpen] = useState(isNewProfile ?? false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(profile.avatarUrl || undefined);
  const [skillsPopoverOpen, setSkillsPopoverOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use appropriate schema based on user role
  const schema = user.role === "student" ? studentProfileSchema : companyProfileSchema;

  const form = useForm<StudentFormData | CompanyFormData>({
    resolver: zodResolver(schema),
    defaultValues: user.role === "student"
      ? {
        // Student profile fields
        name: profile.name || "",
        bio: profile.bio || "",
        skills: Array.isArray(profile.skills) ? profile.skills : [],
        location: profile.location || "",
        university: profile.university || "",
        graduationYear: profile.graduationYear || "",
        major: profile.major || "",
        linkedIn: profile.linkedIn || "",
        previousExperience: profile.previousExperience || "",
        careerGoals: profile.careerGoals || "",
      } as StudentFormData
      : {
        // Company profile fields
        name: profile.name || "",
        company: profile.company || "",
        bio: profile.bio || "",
        website: profile.website || "",
        linkedIn: profile.linkedIn || "",
        industry: Array.isArray(profile.industry) ? profile.industry : [],
        companySize: profile.companySize || "1-10",
        fundingStage: profile.fundingStage || "N/A",
        location: profile.location || "",
        mission: profile.mission || "",
        cultureValues: profile.cultureValues || "",
        investmentThesis: profile.investmentThesis || "",
        portfolioSize: profile.portfolioSize || "",
        investmentRange: profile.investmentRange || "",
      } as CompanyFormData,
  });

  const mutation = useMutation({
    mutationFn: async (data: StudentFormData | CompanyFormData) => {
      const formData = new FormData();
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      // Handle skills separately for student profiles
      if (user.role === "student") {
        const studentData = data as StudentFormData;
        if (studentData.skills && Array.isArray(studentData.skills)) {
          studentData.skills.forEach((skill, index) => {
            formData.append(`skills[${index}]`, skill);
          });
        }
      }

      // Handle all other fields
      Object.entries(data).forEach(([key, value]) => {
        if (value && key !== 'skills') {
          formData.append(key, value.toString());
        }
      });

      const endpoint = user.role === "student" ? '/api/student-profile' : '/api/company-profile';
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      setOpen(false);
      toast({
        title: "Success",
        description: "Profile updated successfully",
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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Edit Profile</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] h-[90vh] overflow-y-scroll">
        <DialogHeader>
          <DialogTitle>
            {isNewProfile ? "Complete Your Profile" : `Edit ${user.role === "student" ? "Student" : "Company"} Profile`}
          </DialogTitle>
          {isNewProfile && (
            <DialogDescription>
              Tell us about yourself to get started
            </DialogDescription>
          )}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(data => mutation.mutate(data))} className="space-y-6">
            {/* Avatar Section */}
            <div className="flex justify-center">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarPreview} />
                  <AvatarFallback>
                    {profile.name ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 p-1 bg-background border border-border rounded-full cursor-pointer hover:bg-accent"
                >
                  <Camera className="h-4 w-4" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>
            </div>

            {/* Common Name Field */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{user.role === "student" ? "Full Name" : "Contact Person Name"}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location Field (Common) */}
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

            {/* Student-specific fields */}
            {user.role === "student" && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="university"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>University</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select university" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PREDEFINED_UNIVERSITIES.map((university) => (
                              <SelectItem key={university} value={university}>
                                {university}
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
                    name="graduationYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Graduation Year</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {graduationYears.map((year) => (
                              <SelectItem key={year} value={year}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="major"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Major/Concentration</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="previousExperience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Previous Experience</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="careerGoals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Career Goals</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="linkedIn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://linkedin.com/in/yourprofile" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Skills field */}
                <MultiSelectField
                  form={form}
                  name="skills"
                  label="Skills"
                  options={PREDEFINED_SKILLS}
                />
              </>
            )}

            {/* Company-specific fields */}
            {user.role !== "student" && (
              <>
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://example.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="linkedIn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://linkedin.com/company/yourcompany" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <MultiSelectField name="industry" label="Industry" form={form} options={IndustriesList}
                  />
                  <FormField
                    control={form.control}
                    name="companySize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Size</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "1-10"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companySizeOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="fundingStage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Funding Stage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "N/A"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select funding stage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {fundingSizeOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
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
                  name="mission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mission Statement</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cultureValues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Culture & Values</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* VC-specific fields */}
                {user.role === "venture_capitalist" && (
                  <>
                    <FormField
                      control={form.control}
                      name="investmentThesis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Investment Thesis</FormLabel>
                          <FormControl>
                            <Textarea className="min-h-[100px]" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="portfolioSize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Portfolio Size</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="investmentRange"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Investment Range</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. $500K-$2M" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}

                {/* Company bio field (renamed from description) */}
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Description</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Bio field (for students only) */}
            {user.role === "student" && (
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-[100px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Saving..."
                : isNewProfile
                  ? "Create Profile"
                  : "Save Changes"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}