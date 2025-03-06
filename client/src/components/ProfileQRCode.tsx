import { QRCodeSVG } from "qrcode.react";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";

export function ProfileQRCode() {
  const { user } = useUser();
  const profileUrl = `${window.location.origin}/profile/${user?.id}`;

  const downloadQRCode = () => {
    const svg = document.getElementById("profile-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      // Download PNG
      const downloadLink = document.createElement("a");
      downloadLink.download = `${user?.username}-profile-qr.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Your Profile QR Code</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Scan to view professional profile
        </p>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="bg-white p-4 rounded-lg">
          <QRCodeSVG
            id="profile-qr-code"
            value={profileUrl}
            size={200}
            level="H"
            includeMargin
            imageSettings={{
              src: "/logo.png",
              height: 24,
              width: 24,
              excavate: true,
            }}
          />
        </div>
        <Button 
          onClick={downloadQRCode}
          className="w-full"
          variant="outline"
        >
          <Download className="w-4 h-4 mr-2" />
          Download QR Code
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Share your QR code to connect instantly with other professionals
        </p>
      </CardContent>
    </Card>
  );
}
