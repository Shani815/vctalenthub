import * as d3 from "d3";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  Network,
  UserCircle,
} from "lucide-react";
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
import { Profile, User } from "@/db/schema";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NetworkOptionsMenu } from "./NetworkOptionsMenu";
import { PaywallModal } from "./PaywallModal";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

// Lazy load the ForceGraph2D component
const ForceGraph2D = lazy(() => import("react-force-graph-2d"));

interface NetworkNode {
  id: string;
  name: string;
  role: "student" | "venture_capitalist" | "startup";
  val: number;
  avatarUrl?: string | null;
  color?: string;
  level?: number;
  parentId?: string;
  x?: number;
  y?: number;
}

interface NetworkLink {
  source: string;
  target: string;
  distance?: number;
}

interface NetworkMapProps {
  users: (User & { profile: Profile })[];
  connections: { fromUserId: number; toUserId: number; type: string }[];
  width?: number;
  height?: number;
  currentUserId: number;
}

interface ForceGraphNodeObject {
  id?: string | number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
  val?: number;
}

export function NetworkMap({
  users: initialUsers,
  connections: initialConnections,
  width = 800,
  height = 600,
  currentUserId,
}: NetworkMapProps) {
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [networkData, setNetworkData] = useState({
    users: initialUsers,
    connections: initialConnections,
  });
  const [dimensions, setDimensions] = useState({ width, height });
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [showConnectionsDialog, setShowConnectionsDialog] = useState(false);
  const [showPremiumAlert, setShowPremiumAlert] = useState(false);
  const [connectionTree, setConnectionTree] = useState<NetworkNode[]>([]);
  const [connectionPath, setConnectionPath] = useState<string[]>([]);
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: Math.min(window.innerWidth * 0.9, 1400),
        height: Math.min(window.innerHeight * 0.7, 800),
      });
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleViewConnections = useCallback(
    async (nodeId: string) => {
      if (currentUser?.tier !== "premium") {
        setShowPremiumAlert(true);
        return;
      }

      try {
        // Fetch connections for this node
        const response = await fetch(`/api/network/connections/${nodeId}`);
        if (!response.ok) throw new Error("Failed to fetch connections");
        const data = await response.json();

        setNetworkData((prev) => {
          // Filter out any duplicate users
          const newUsers = data.nodes.filter(
            (node: any) =>
              !prev.users.some((u) => u.id.toString() === node.id.toString())
          );

          // Create new connections for all nodes in the response
          const newConnections = data.nodes.map((node: any) => ({
            fromUserId: parseInt(nodeId),
            toUserId: parseInt(node.id),
            type: "connected",
          }));

          // Map the API response nodes to our user format
          const mappedUsers = newUsers.map((node: any) => ({
            id: parseInt(node.id),
            username: node.username || node.name,
            role: node.role,
            profile: {
              name: node.name,
              avatarUrl: node.avatarUrl,
            },
          }));

          // Return updated state with new users and connections
          return {
            users: [...prev.users, ...mappedUsers],
            connections: [
              ...prev.connections,
              ...newConnections.filter(
                (conn) =>
                  // Filter out any duplicate connections
                  !prev.connections.some(
                    (existing) =>
                      (existing.fromUserId === conn.fromUserId &&
                        existing.toUserId === conn.toUserId) ||
                      (existing.fromUserId === conn.toUserId &&
                        existing.toUserId === conn.fromUserId)
                  )
              ),
            ],
          };
        });

        // Toggle expanded nodes
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          if (next.has(nodeId)) {
            next.delete(nodeId);
          } else {
            next.add(nodeId);
          }
          return next;
        });

        // Close the menu
        setSelectedNode(null);
        setMenuPosition(null);

        // Log the updated data for debugging
        // console.log("API Response:", data);
        // console.log("Updated Network Data:", networkData);
        // console.log("Expanded Nodes:", expandedNodes);
      } catch (error) {
        console.error("Error fetching connections:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load connections",
        });
      }
    },
    [currentUser?.tier, toast, networkData]
  );

  const handleNodeClick = useCallback(
    (node: any, event: MouseEvent) => {
      if (node.id === currentUserId.toString()) return;

      // Get canvas position
      const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
      const scale = rect.width / dimensions.width;

      // Calculate screen coordinates for the menu
      const screenX = rect.left + node.x * scale;
      const screenY = rect.top + node.y * scale;

      setSelectedNode(node);
      setMenuPosition({ x: screenX, y: screenY });
    },
    [currentUserId, dimensions.width]
  );

  const handleViewProfile = useCallback((nodeId: string) => {
    window.location.href = `/profile/${nodeId}`;
  }, []);

  const handleBackClick = useCallback(() => {
    if (connectionPath.length > 1) {
      setConnectionPath((prev) => prev.slice(0, -1));
      // Update connection tree based on new path
    } else {
      setShowConnectionsDialog(false);
      setConnectionPath([]);
      setActiveParentId(null);
    }
  }, [connectionPath.length]);

  // Add function to get initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Add function to get node color
  const getNodeColor = (role: string) => {
    switch (role) {
      case "student":
        return "hsl(221, 83%, 53%)";
      case "venture_capitalist":
        return "hsl(142, 76%, 36%)";
      case "startup":
        return "hsl(345, 83%, 53%)";
      default:
        return "hsl(215, 25%, 27%)";
    }
  };

  // Update the nodeCanvasObject function
  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const { x, y } = node;
      const label = node.name;
      const size = Math.max(12, node.val * 10) / globalScale;
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px Inter`;
      const textWidth = ctx.measureText(label).width;
      const radius = Math.sqrt(node.val) * 8;
      try {
        // Load and draw avatar if available
        const avatar = new Image();
        avatar.src = node.avatarUrl || "/default-avatar.png";

        // Draw circular clipping path for avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.clip();
        // Draw white background for avatar/initials
        ctx.fillStyle = getNodeColor(node.role);
        ctx.fill();

        // Draw avatar or fallback circle
        if (node.avatarUrl) {
          ctx.drawImage(
            avatar,
            node.x - radius,
            node.y - radius,
            radius * 2,
            radius * 2
          );
        } else {
          // Fallback colored circle
          ctx.fillStyle = "white";
          ctx.font = `bold ${size}px Inter`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(getInitials(label), x, y);
        }
        ctx.restore();

        // Draw node border
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = "#2463EB";
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();

        // Text background
        const bgHeight = fontSize + 4;
        ctx.fillStyle = "transparent";
        ctx.fillRect(
          node.x - textWidth / 2 - 4,
          node.y + radius + 4,
          textWidth + 2,
          bgHeight
        );

        // Text
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#1a1a1a";
        ctx.fillText(label, node.x, node.y + radius + bgHeight / 2);
      } catch (err) {
        console.error("NetworkMap canvas rendering error:", err);
        ctx.fillStyle = getNodeColor(node.role);
        ctx.font = `bold ${size}px Inter`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(getInitials(label), x, y);
      }
    },
    []
  );

  const graphData = useMemo(() => {
    // console.log("Calculating Graph Data");
    // console.log("Network Data:", networkData);
    // console.log("Expanded Nodes:", expandedNodes);

    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];
    const processedNodes = new Set<string>();

    const addNodeAndConnections = (
      userId: number | string,
      level: number = 0,
      parentId?: string
    ) => {
      const userIdStr = userId.toString();
      if (processedNodes.has(userIdStr)) return;

      const user = networkData.users.find((u) => u.id.toString() === userIdStr);
      if (!user) {
        // console.log("User not found:", userIdStr);
        return;
      }

      // Add the node
      processedNodes.add(userIdStr);
      nodes.push({
        id: userIdStr,
        name: user.profile?.name || user.username,
        role: user.role as "student" | "venture_capitalist" | "startup",
        val: userIdStr === currentUserId.toString() ? 4 : 3,
        avatarUrl: user.profile?.avatarUrl,
        level,
        parentId,
      });

      // If this node is expanded or is the current user, add its connections
      if (
        expandedNodes.has(userIdStr) ||
        userIdStr === currentUserId.toString()
      ) {
        const nodeConnections = networkData.connections.filter(
          (conn) =>
            conn.type === "connected" &&
            (conn.fromUserId.toString() === userIdStr ||
              conn.toUserId.toString() === userIdStr)
        );

        // console.log(`Connections for node ${userIdStr}:`, nodeConnections);

        nodeConnections.forEach((conn) => {
          const connectedId = (
            conn.fromUserId.toString() === userIdStr
              ? conn.toUserId
              : conn.fromUserId
          ).toString();

          // Add link with increased distance
          links.push({
            source: userIdStr,
            target: connectedId,
          });

          // Recursively add connected node and its connections if not already processed
          if (!processedNodes.has(connectedId)) {
            addNodeAndConnections(connectedId, level + 1, userIdStr);
          }
        });
      }
    };

    // Start with current user
    addNodeAndConnections(currentUserId);

    // console.log("Generated Graph Data:", { nodes, links });
    return { nodes, links };
  }, [networkData, currentUserId, expandedNodes]);

  // console.log(graphData);

  return (
    <div className="relative w-full h-full">
      <Card className="border-none bg-transparent p-6">
        {activeParentId && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 left-4 z-10"
            onClick={() => setActiveParentId(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to My Network
          </Button>
        )}

        <Suspense fallback={<div>Loading...</div>}>
          <ForceGraph2D
            graphData={graphData}
            nodeCanvasObject={nodeCanvasObject as any}
            nodeCanvasObjectMode={() => "after"}
            linkColor={() => "grey"}
            width={dimensions.width}
            height={dimensions.height}
            onNodeClick={handleNodeClick}
            onNodeHover={(node) => setHoveredNode(node as NetworkNode)}
            cooldownTicks={100}
            d3VelocityDecay={0.3}
            d3AlphaDecay={0.02}
            nodeRelSize={8}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            dagMode="radialin"
            dagLevelDistance={50}
          />
        </Suspense>
      </Card>

      {selectedNode && menuPosition && (
        <NetworkOptionsMenu
          x={menuPosition.x}
          y={menuPosition.y}
          nodeId={selectedNode.id}
          onViewProfile={() => handleViewProfile(selectedNode.id)}
          onViewConnections={() => handleViewConnections(selectedNode.id)}
        />
      )}

      <Dialog
        open={showConnectionsDialog}
        onOpenChange={setShowConnectionsDialog}
      >
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleBackClick}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle>{connectionPath.join(" > ")}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {connectionTree.map((connection) => (
              <Card
                key={connection.id}
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleViewConnections(connection.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{connection.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {connection.role.replace("_", " ")}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <PaywallModal
        isOpen={showPremiumAlert}
        onClose={() => setShowPremiumAlert(false)}
        feature="viewConnections"
      />
    </div>
  );
}
