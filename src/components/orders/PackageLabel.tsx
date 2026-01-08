import { useState, useCallback } from "react";
import { FileDown, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Button } from "@/components/ui/button";
import type { Order } from "@/types/auth";
import { useToast } from "@/hooks/use-toast";
import labelHeaderImage from "@/assets/label-header.png";
import labelFragileImage from "@/assets/label-fragile.png";

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

// Generate QR code as PNG using canvas
const generateQRCodeImage = async (size: number = 120): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const qrContainer = document.getElementById("qr-code-container");
    if (!qrContainer) {
      reject(new Error("QR container not found"));
      return;
    }
    
    const svgElement = qrContainer.querySelector("svg");
    if (!svgElement) {
      reject(new Error("SVG not found"));
      return;
    }
    
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      
      canvas.toBlob((blob) => {
        if (blob) {
          blob.arrayBuffer().then((buffer) => {
            resolve(new Uint8Array(buffer));
          });
        } else {
          reject(new Error("Failed to create blob"));
        }
      }, "image/png");
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG"));
    };
    
    img.src = url;
  });
};

// Load image as bytes for PDF embedding
const loadImageAsBytes = async (imageSrc: string): Promise<Uint8Array> => {
  const response = await fetch(imageSrc);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
};

export function PackageLabel({ order }: PackageLabelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const canGenerateLabel = Boolean(order.tracking_id && order.shipment_id);
  const qrValue = order.tracking_url || order.tracking_id || order.id;

  const generatePDFFromScratch = useCallback(async (): Promise<Uint8Array> => {
    // Create a new PDF document - 4x6 inches (288 x 432 points)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([288, 432]);
    const { width, height } = page.getSize();
    
    // Embed fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Colors
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.85, 0.85, 0.85);
    
    // ============================================
    // HEADER - Full width banner with logo
    // ============================================
    try {
      const headerBytes = await loadImageAsBytes(labelHeaderImage);
      const headerImg = await pdfDoc.embedPng(headerBytes);
      const headerHeight = 36;
      const headerY = height - headerHeight - 8;
      
      page.drawImage(headerImg, {
        x: 8,
        y: headerY,
        width: width - 16,
        height: headerHeight,
      });
    } catch (error) {
      console.error("Failed to embed header:", error);
      // Fallback: Draw text header
      page.drawRectangle({
        x: 8,
        y: height - 44,
        width: width - 16,
        height: 36,
        color: rgb(0.95, 0.95, 0.95),
        borderColor: lightGray,
        borderWidth: 1,
      });
      page.drawText("CANADA HARM CONTROL", {
        x: 16,
        y: height - 28,
        size: 12,
        font: helveticaBold,
        color: black,
      });
      page.drawText("EndOverdose.ca", {
        x: 16,
        y: height - 40,
        size: 8,
        font: helvetica,
        color: gray,
      });
    }
    
    // ============================================
    // DIVIDER LINE below header
    // ============================================
    page.drawLine({
      start: { x: 8, y: height - 52 },
      end: { x: width - 8, y: height - 52 },
      thickness: 1,
      color: lightGray,
    });
    
    // ============================================
    // FROM SECTION - X: 16, Y: 320
    // ============================================
    const fromStartY = 320;
    
    page.drawText("FROM:", {
      x: 16,
      y: fromStartY,
      size: 8,
      font: helveticaBold,
      color: gray,
    });
    
    page.drawText("CanadaHarmControl", {
      x: 16,
      y: fromStartY - 14,
      size: 10,
      font: helveticaBold,
      color: black,
    });
    
    page.drawText("Healthcare Delivery Service", {
      x: 16,
      y: fromStartY - 26,
      size: 8,
      font: helvetica,
      color: gray,
    });
    
    page.drawText("3265 Wharton Way #23", {
      x: 16,
      y: fromStartY - 38,
      size: 8,
      font: helvetica,
      color: black,
    });
    
    page.drawText("Mississauga, ON L4X 2X9", {
      x: 16,
      y: fromStartY - 50,
      size: 8,
      font: helvetica,
      color: black,
    });
    
    page.drawText("(647) 494-4538", {
      x: 16,
      y: fromStartY - 62,
      size: 8,
      font: helvetica,
      color: black,
    });
    
    // ============================================
    // RIGHT COLUMN - Order details
    // ============================================
    const rightColX = 160;
    
    // Order Date
    page.drawText("ORDER DATE:", {
      x: rightColX,
      y: 320,
      size: 7,
      font: helveticaBold,
      color: gray,
    });
    page.drawText(formatDate(order.order_date), {
      x: rightColX,
      y: 308,
      size: 9,
      font: helvetica,
      color: black,
    });
    
    // Shipped Date
    page.drawText("SHIPPED:", {
      x: rightColX,
      y: 290,
      size: 7,
      font: helveticaBold,
      color: gray,
    });
    const shippedDate = formatDate(order.shipped_at);
    const shippedTime = formatTime(order.shipped_at);
    page.drawText(shippedDate, {
      x: rightColX,
      y: 278,
      size: 9,
      font: helvetica,
      color: black,
    });
    if (shippedTime) {
      page.drawText(shippedTime, {
        x: rightColX + 60,
        y: 278,
        size: 8,
        font: helvetica,
        color: gray,
      });
    }
    
    // Shipment ID
    page.drawText("SHIPMENT ID:", {
      x: rightColX,
      y: 260,
      size: 7,
      font: helveticaBold,
      color: gray,
    });
    page.drawText(order.shipment_id || "N/A", {
      x: rightColX,
      y: 248,
      size: 9,
      font: helveticaBold,
      color: black,
    });
    
    // ============================================
    // FRAGILE BADGE - Right side, middle area
    // ============================================
    try {
      const fragileBytes = await loadImageAsBytes(labelFragileImage);
      const fragileImg = await pdfDoc.embedPng(fragileBytes);
      
      page.drawImage(fragileImg, {
        x: rightColX,
        y: 200,
        width: 100,
        height: 28,
      });
    } catch (error) {
      console.error("Failed to embed fragile badge:", error);
    }
    
    // ============================================
    // DIVIDER LINE between FROM and SHIP TO
    // ============================================
    page.drawLine({
      start: { x: 8, y: 245 },
      end: { x: 140, y: 245 },
      thickness: 1,
      color: lightGray,
    });
    
    // ============================================
    // SHIP TO SECTION - X: 16, Y: 230
    // ============================================
    const shipToStartY = 230;
    
    page.drawText("SHIP TO:", {
      x: 16,
      y: shipToStartY,
      size: 8,
      font: helveticaBold,
      color: gray,
    });
    
    page.drawText(order.client_name || "Customer", {
      x: 16,
      y: shipToStartY - 14,
      size: 11,
      font: helveticaBold,
      color: black,
    });
    
    if (order.address_line_1) {
      page.drawText(order.address_line_1, {
        x: 16,
        y: shipToStartY - 28,
        size: 9,
        font: helvetica,
        color: black,
      });
    }
    
    if (order.address_line_2) {
      page.drawText(order.address_line_2, {
        x: 16,
        y: shipToStartY - 40,
        size: 9,
        font: helvetica,
        color: black,
      });
    }
    
    page.drawText(order.country || "Canada", {
      x: 16,
      y: shipToStartY - 52,
      size: 9,
      font: helvetica,
      color: black,
    });
    
    // ============================================
    // BOTTOM SECTION DIVIDER
    // ============================================
    page.drawLine({
      start: { x: 8, y: 160 },
      end: { x: width - 8, y: 160 },
      thickness: 1,
      color: lightGray,
    });
    
    // ============================================
    // QR CODE - X: 16, Y: 50, Size: 100x100
    // ============================================
    try {
      const qrPngBytes = await generateQRCodeImage(120);
      const qrImage = await pdfDoc.embedPng(qrPngBytes);
      
      page.drawImage(qrImage, {
        x: 16,
        y: 50,
        width: 100,
        height: 100,
      });
    } catch (error) {
      console.error("Failed to embed QR code:", error);
      // Draw placeholder box
      page.drawRectangle({
        x: 16,
        y: 50,
        width: 100,
        height: 100,
        borderColor: lightGray,
        borderWidth: 1,
      });
      page.drawText("QR CODE", {
        x: 45,
        y: 95,
        size: 10,
        font: helvetica,
        color: gray,
      });
    }
    
    // ============================================
    // TRACKING INFO - Right side of QR
    // ============================================
    page.drawText("TRACKING NUMBER:", {
      x: 130,
      y: 140,
      size: 7,
      font: helveticaBold,
      color: gray,
    });
    
    const trackingId = order.tracking_id || "N/A";
    page.drawText(trackingId, {
      x: 130,
      y: 122,
      size: 12,
      font: helveticaBold,
      color: black,
    });
    
    // Scan instructions
    page.drawText("Scan QR code to track", {
      x: 130,
      y: 100,
      size: 8,
      font: helvetica,
      color: gray,
    });
    page.drawText("your delivery status", {
      x: 130,
      y: 88,
      size: 8,
      font: helvetica,
      color: gray,
    });
    
    // ============================================
    // FOOTER BAR
    // ============================================
    page.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: 36,
      color: rgb(0.1, 0.1, 0.1),
    });
    
    page.drawText("HEALTHCARE DELIVERY • HANDLE WITH CARE", {
      x: 40,
      y: 16,
      size: 8,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    
    return await pdfDoc.save() as unknown as Uint8Array;
  }, [order, qrValue]);

  const generatePDF = useCallback(async () => {
    setIsGenerating(true);
    try {
      const pdfBytes = await generatePDFFromScratch();
      
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `label-${order.shipment_id || order.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Label Downloaded", description: "Package label PDF has been downloaded" });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ title: "Error", description: "Failed to generate label PDF", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [generatePDFFromScratch, order.shipment_id, order.id, toast]);

  const printLabel = useCallback(async () => {
    setIsGenerating(true);
    try {
      const pdfBytes = await generatePDFFromScratch();
      
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
        };
      }
      
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      
    } catch (error) {
      console.error("Print error:", error);
      toast({ title: "Error", description: "Failed to print label", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [generatePDFFromScratch, toast]);

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

  return (
    <div className="space-y-4">
      {/* Hidden QR Code for capture */}
      <div id="qr-code-container" style={{ position: "absolute", left: "-9999px" }}>
        <QRCodeSVG 
          value={qrValue}
          size={120}
          level="M"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
      
      {/* Label Preview Card */}
      <div className="bg-background rounded-xl border border-border overflow-hidden">
        <div className="p-4 bg-muted/30 border-b border-border">
          <p className="text-sm font-medium text-foreground">Package Label Preview</p>
          <p className="text-xs text-muted-foreground mt-1">4×6" shipping label with QR tracking</p>
        </div>
        
        <div className="p-4 space-y-3">
          {/* Preview info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Ship To</p>
              <p className="font-medium">{order.client_name || "Customer"}</p>
              <p className="text-muted-foreground text-xs">{order.address_line_1}</p>
              {order.address_line_2 && <p className="text-muted-foreground text-xs">{order.address_line_2}</p>}
              <p className="text-muted-foreground text-xs">{order.country || "Canada"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">From</p>
              <p className="font-medium">CanadaHarmControl</p>
              <p className="text-muted-foreground text-xs">Healthcare Delivery Service</p>
              <p className="text-muted-foreground text-xs">3265 Wharton Way #23, Mississauga</p>
            </div>
          </div>
          
          <div className="border-t border-border pt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Tracking #</p>
              <p className="font-mono font-medium">{order.tracking_id}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Shipment ID</p>
              <p className="font-mono font-medium">{order.shipment_id}</p>
            </div>
          </div>
          
          <div className="border-t border-border pt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Shipped Date</p>
              <p className="font-medium">{formatDate(order.shipped_at)}</p>
              {order.shipped_at && <p className="text-xs text-muted-foreground">{formatTime(order.shipped_at)}</p>}
            </div>
            <div className="flex items-center justify-center">
              <QRCodeSVG 
                value={qrValue}
                size={60}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
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
