import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Award, Briefcase, GraduationCap, MessageSquareText, Network, Settings, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { useUser } from "@/hooks/use-user";
import { useQuery } from "@tanstack/react-query";
import type { Profile } from "@/db/schema";

export default function Navbar() {
  const { user, logout } = useUser();
  const { data: profile } = useQuery<Profile>({
    queryKey: ['/api/profile']
  });

  // Check if user is a hiring entity (VC or Startup)
  const isHiringEntity = user?.role === 'venture_capitalist' || user?.role === 'startup';

  return (
    <nav className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center">
              <span className="bg-primary text-white text-xs font-semibold rounded-full px-2 py-1 mr-2">Beta</span>
              <Link href="/" className="flex items-center">
                <span className="text-xl font-bold text-primary">BlueBox</span>
              </Link>
            </div>
            <Link href="/feed" className="flex items-center text-muted-foreground hover:text-foreground">
              <MessageSquareText className="w-4 h-4 mr-2" />
              Feed
            </Link>
            <Link href="/network" className="flex items-center text-muted-foreground hover:text-foreground">
              <Network className="w-4 h-4 mr-2" />
              Network
            </Link>
            <Link href="/highlights" className="flex items-center text-muted-foreground hover:text-foreground">
              <Award className="w-4 h-4 mr-2" />
              Highlights
            </Link>
            {isHiringEntity ? (
              <Link href="/hire" className="flex items-center text-muted-foreground hover:text-foreground">
                <GraduationCap className="w-4 h-4 mr-2" />
                Hire
              </Link>
            ) : (
              <Link href="/jobs" className="flex items-center text-muted-foreground hover:text-foreground">
                <Briefcase className="w-4 h-4 mr-2" />
                Jobs
              </Link>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <NotificationsDropdown />
            {user?.role === 'admin' && (
              <Link href="/admin" className="flex items-center text-muted-foreground hover:text-foreground">
                <Shield className="w-4 h-4 mr-2" />
                Admin
              </Link>
            )}
            <Badge variant={user?.tier === 'premium' ? "default" : "secondary"}>
              {user?.tier === 'premium' ? 'Premium' : 'Free'}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    {profile?.avatarUrl ? <AvatarImage src={profile?.avatarUrl} />
                      :
                      <AvatarFallback className="text-lg">
                        {profile?.name ?
                          profile.name.split(' ').map(n => n[0]).join('').toUpperCase()
                          :
                          user?.username.charAt(0).toUpperCase()
                        }
                      </AvatarFallback>
                    }
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/pricing">Manage Subscription</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logout()}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}