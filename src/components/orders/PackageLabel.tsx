import { useRef, useState, useCallback } from "react";
import { FileDown, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import type { Order } from "@/types/auth";
import { useToast } from "@/hooks/use-toast";
import { useLabelSettings } from "@/hooks/useLabelSettings";

interface PackageLabelProps {
  order: Order;
}

const formatDate = (date: string | null): string => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (date: string | null): string => {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const CANVAS_OPTIONS = {
  scale: 3,
  backgroundColor: "#ffffff",
  useCORS: true,
  logging: false,
};

export function PackageLabel({ order }: PackageLabelProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { settings: labelSettings, isLoading: isLoadingSettings } = useLabelSettings();

  const canGenerateLabel = Boolean(order.tracking_id && order.shipment_id);
  const qrValue = order.tracking_id || order.id;

  const generateCanvas = useCallback(async () => {
    if (!labelRef.current) return null;
    return html2canvas(labelRef.current, CANVAS_OPTIONS);
  }, []);

  const generatePDF = useCallback(async () => {
    setIsGenerating(true);
    try {
      const canvas = await generateCanvas();
      if (!canvas) throw new Error("Failed to generate canvas");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "in",
        format: [4, 6],
      });

      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 4, 6);
      pdf.save(`label-${order.shipment_id || order.id}.pdf`);

      toast({ title: "Label Downloaded", description: "Package label PDF has been downloaded" });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ title: "Error", description: "Failed to generate label PDF", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [generateCanvas, order.shipment_id, order.id, toast]);

  const printLabel = useCallback(async () => {
    setIsGenerating(true);
    try {
      const canvas = await generateCanvas();
      if (!canvas) throw new Error("Failed to generate canvas");

      const printWindow = window.open("", "_blank");
      if (!printWindow) throw new Error("Failed to open print window");

      const imageData = canvas.toDataURL("image/png");
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Package Label - ${order.shipment_id || order.id}</title>
            <style>
              @page { size: 4in 6in; margin: 0; }
              * { margin: 0; padding: 0; }
              body { display: flex; justify-content: center; align-items: center; }
              img { width: 4in; height: 6in; object-fit: contain; }
            </style>
          </head>
          <body><img src="${imageData}" /></body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    } catch (error) {
      console.error("Print error:", error);
      toast({ title: "Error", description: "Failed to print label", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [generateCanvas, order.shipment_id, order.id, toast]);

  if (!canGenerateLabel) {
    return (
      <div className="bg-muted/30 rounded-xl p-6 border border-dashed border-border">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
            <FileDown className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Label Not Available</p>
          <p className="text-xs text-muted-foreground/70">Assign a driver to generate tracking & shipment IDs</p>
        </div>
      </div>
    );
  }

  if (isLoadingSettings) {
    return (
      <div className="bg-muted/30 rounded-xl p-6 border border-border flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Use address_line_1 and address_line_2 for the address display
  const addressDisplay = [order.address_line_1, order.address_line_2].filter(Boolean).join(', ');

  return (
    <div className="space-y-4">
      <div className="bg-background rounded-xl border border-border overflow-hidden">
        {/* Label Container - Uses inline styles for PDF compatibility */}
        <div
          ref={labelRef}
          style={{
            width: "100%",
            aspectRatio: "4/6",
            padding: "16px",
            backgroundColor: "#ffffff",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {/* Header Bar */}
          <div style={{ height: "12px", backgroundColor: "#F97316", margin: "-16px -16px 12px -16px" }} />

          {/* From Section - Two Column Layout */}
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #d1d5db", paddingBottom: "10px", marginBottom: "10px" }}>
            {/* Left Side - FROM */}
            <div>
              <p style={{ fontSize: "10px", fontWeight: "bold", color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>FROM</p>
              <p style={{ fontSize: "14px", fontWeight: "600", color: "#000000", marginBottom: "1px" }}>{labelSettings.from_company}</p>
              <p style={{ fontSize: "11px", color: "#374151", marginBottom: "1px" }}>{labelSettings.from_tagline}</p>
              <p style={{ fontSize: "9px", color: "#6b7280" }}>{labelSettings.from_website}</p>
            </div>
            {/* Right Side - CONTACT */}
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "10px", fontWeight: "bold", color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>CONTACT</p>
              <p style={{ fontSize: "11px", color: "#000000", marginBottom: "1px" }}>{labelSettings.contact_address}</p>
              <p style={{ fontSize: "11px", color: "#000000", marginBottom: "1px" }}>{labelSettings.contact_phone}</p>
              <p style={{ fontSize: "10px", color: "#374151" }}>{labelSettings.contact_email}</p>
            </div>
          </div>

          {/* Shipment Info Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #d1d5db", paddingBottom: "10px", marginBottom: "10px" }}>
            <div>
              <p style={{ fontSize: "10px", fontWeight: "bold", color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px" }}>Shipment ID</p>
              <p style={{ fontSize: "14px", fontFamily: "monospace", fontWeight: "bold", color: "#000000" }}>{order.shipment_id}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "10px", fontWeight: "bold", color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px" }}>Shipped Date</p>
              <p style={{ fontSize: "13px", fontWeight: "600", color: "#000000", marginBottom: "1px" }}>{formatDate(order.shipped_at)}</p>
              {order.shipped_at && <p style={{ fontSize: "10px", color: "#6b7280" }}>{formatTime(order.shipped_at)}</p>}
            </div>
          </div>

          {/* Stickers as inline SVG images for consistent PDF export */}
          <div style={{ marginBottom: "10px" }}>
            <svg width="70" height="24" viewBox="0 0 70 24" style={{ display: "block" }}>
              {/* FRAGILE Sticker */}
              <rect x="0" y="0" width="70" height="22" rx="4" fill="#dc2626" stroke="#b91c1c" strokeWidth="2"/>
              <text x="35" y="15" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="system-ui, sans-serif">⚠️ FRAGILE</text>
            </svg>
          </div>

          {/* SHIP TO Badge as inline SVG for consistent PDF export */}
          <div style={{ marginBottom: "8px" }}>
            <svg width="60" height="20" viewBox="0 0 60 20" style={{ display: "block" }}>
              <rect x="0" y="0" width="60" height="20" rx="4" fill="#000000"/>
              <text x="30" y="14" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="system-ui, sans-serif" letterSpacing="0.5">SHIP TO</text>
            </svg>
          </div>

          {/* Recipient Details */}
          <div style={{ marginBottom: "4px" }}>
            <p style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", margin: "0" }}>{order.client_name || "Customer"}</p>
            <p style={{ fontSize: "13px", color: "#000000", margin: "2px 0" }}>{order.address_line_1 || ""}</p>
            {order.address_line_2 && <p style={{ fontSize: "13px", color: "#000000", margin: "2px 0" }}>{order.address_line_2}</p>}
            <p style={{ fontSize: "13px", color: "#000000", margin: "2px 0" }}>{order.country || "Canada"}</p>
          </div>

          {/* QR Code Section */}
          <div style={{ borderTop: "1px solid #d1d5db", paddingTop: "12px", marginTop: "auto" }}>
            <p style={{ fontSize: "10px", fontWeight: "bold", color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center", marginBottom: "8px" }}>
              SCAN TO TRACK
            </p>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
              <QRCodeSVG 
                value={qrValue}
                size={120}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
              <p style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: 600, color: "#374151", marginTop: "8px" }}>
                {order.tracking_id}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="sm" onClick={printLabel} disabled={isGenerating} className="gap-2">
          <Printer className="w-4 h-4" />
          Print
        </Button>
        <Button size="sm" onClick={generatePDF} disabled={isGenerating} className="gap-2">
          <FileDown className="w-4 h-4" />
          Download PDF
        </Button>
      </div>
    </div>
  );
}
