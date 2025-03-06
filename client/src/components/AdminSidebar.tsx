import { BarChart2, Briefcase, TicketSlashIcon, UserCog, Users } from "lucide-react";
import { Link, useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminSidebar() {
  const [location] = useLocation();

  const menuItems = [
    {
      title: "Overview",
      icon: BarChart2,
      href: "/admin",
    },
    {
      title: "Manage Users",
      icon: UserCog,
      href: "/admin/users",
    },
    {
      title: "Job Postings",
      icon: Briefcase,
      href: "/admin/jobs",
    },  
    {
      title: "Manage Referral Code",
      icon: TicketSlashIcon,
      href: "/admin/manage-referral-code",
    },
  ];

  return (
    <div className="h-full space-y-4 py-4 flex flex-col bg-card">
      {menuItems.map((item) => {
        const isActive = location === item.href;
        const Icon = item.icon;

        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-2",
                isActive && "bg-primary/10"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Button>
          </Link>
        );
      })}
    </div>
  );
}