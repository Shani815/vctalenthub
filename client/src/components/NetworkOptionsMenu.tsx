import { Network, UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface NetworkOptionsMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onViewProfile: () => void;
  onViewConnections: () => void;
}

export function NetworkOptionsMenu({
  x,
  y,
  nodeId,
  onViewProfile,
  onViewConnections,
}: NetworkOptionsMenuProps) {
  return (
    <Card
      className="absolute z-50 bg-white/95 backdrop-blur-sm shadow-lg border-none divide-y divide-muted/20 overflow-hidden w-40"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -120%) translateY(-10px)'
      }}
    >
      <Button
        variant="ghost"
        className="w-full h-9 px-3 justify-start text-sm font-normal hover:bg-muted/50"
        onClick={onViewProfile}
      >
        <UserCircle className="h-4 w-4 mr-2" />
        View Profile
      </Button>
      <Button
        variant="ghost"
        className="w-full h-9 px-3 justify-start text-sm font-normal hover:bg-muted/50"
        onClick={onViewConnections}
      >
        <Network className="h-4 w-4 mr-2" />
        View Connections
      </Button>
    </Card>
  );
} 