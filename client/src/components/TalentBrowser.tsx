import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, GraduationCap, MapPin, Calendar, Briefcase } from "lucide-react";
import { PREDEFINED_UNIVERSITIES, PREDEFINED_INDUSTRIES, GRADUATION_YEARS } from "../pages/DashboardPage";

type StudentProfile = {
  id: number;
  name: string;
  bio: string | null;
  skills: string[];
  location: string;
  university: string;
  graduationYear: string;
  major: string;
  avatarUrl: string | null;
  careerGoals: string | null;
  industry: string | null;
};

export function TalentBrowser() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUniversity, setSelectedUniversity] = useState<string | "all">("all");
  const [selectedYear, setSelectedYear] = useState<string | "all">("all");
  const [selectedIndustry, setSelectedIndustry] = useState<string | "all">("all");

  const { data: students, isLoading } = useQuery<StudentProfile[]>({
    queryKey: ['/api/students'],
  });

  const filteredStudents = useMemo(() => {
    if (!students) return [];

    return students.filter(student => {
      const matchesSearch = !searchQuery || 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.major.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesUniversity = selectedUniversity === "all" || 
        student.university === selectedUniversity;

      const matchesYear = selectedYear === "all" || 
        student.graduationYear === selectedYear;

      const matchesIndustry = selectedIndustry === "all" || 
        student.industry === selectedIndustry;

      return matchesSearch && matchesUniversity && matchesYear && matchesIndustry;
    });
  }, [students, searchQuery, selectedUniversity, selectedYear, selectedIndustry]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, bio, or major"
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={selectedUniversity} onValueChange={setSelectedUniversity}>
              <SelectTrigger>
                <SelectValue placeholder="University" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Universities</SelectItem>
                {PREDEFINED_UNIVERSITIES.map((uni) => (
                  <SelectItem key={uni} value={uni}>
                    {uni}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Graduation Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {GRADUATION_YEARS.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
              <SelectTrigger>
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {PREDEFINED_INDUSTRIES.map((industry) => (
                  <SelectItem key={industry} value={industry}>
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 rounded-full bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredStudents?.map((student) => (
          <Card key={student.id} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <Avatar className="h-16 w-16 border">
                  <AvatarImage src={student.avatarUrl || ''} />
                  <AvatarFallback>
                    {student.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate">{student.name}</h3>
                  <div className="flex items-center text-sm text-muted-foreground mt-1">
                    <GraduationCap className="h-4 w-4 mr-1" />
                    {student.university}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground mt-1">
                    <Calendar className="h-4 w-4 mr-1" />
                    Class of {student.graduationYear}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground mt-1">
                    <MapPin className="h-4 w-4 mr-1" />
                    {student.location}
                  </div>
                  {student.industry && (
                    <div className="flex items-center text-sm text-muted-foreground mt-1">
                      <Briefcase className="h-4 w-4 mr-1" />
                      {student.industry}
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-4 text-sm text-muted-foreground line-clamp-3">
                {student.bio || student.careerGoals}
              </p>
              {student.skills && (
                <div className="mt-4 flex flex-wrap gap-2">
                {student.skills?.slice(0, 3).map((skill, index) => (
                  <Badge key={index} variant="secondary">
                    {skill}
                  </Badge>
                ))}
                {student.skills.length > 3 && (
                  <Badge variant="secondary">
                    +{student.skills.length - 3} more
                  </Badge>
                  )}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <Button variant="secondary">View Profile</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
