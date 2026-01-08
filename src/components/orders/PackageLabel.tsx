import { useRef, useState, useCallback } from "react";
import { FileDown, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
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

// Convert QR code SVG to PNG data URL for PDF embedding
const generateQRCodePNG = async (value: string, size: number = 100): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = size;
    canvas.height = size;
    
    // Create temporary container for QR code
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    document.body.appendChild(container);
    
    // Render QR code SVG
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", size.toString());
    svg.setAttribute("height", size.toString());
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    
    // Use a library-free QR approach - create image from existing QR component
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"></svg>`;
    
    // For simplicity, we'll generate a placeholder and use the actual QR from the preview
    // In production, you'd use a proper QR library that outputs to canvas
    const img = new Image();
    const svgData = document.querySelector(`[data-qr-value="${value}"]`)?.outerHTML || 
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect fill="white" width="100%" height="100%"/><text x="50%" y="50%" text-anchor="middle">QR</text></svg>`;
    
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      document.body.removeChild(container);
      resolve(canvas.toDataURL("image/png"));
    };
    
    img.onerror = () => {
      // Fallback: return empty image
      URL.revokeObjectURL(url);
      document.body.removeChild(container);
      resolve(canvas.toDataURL("image/png"));
    };
    
    img.src = url;
  });
};

// Generate QR code as PNG using canvas
const generateQRCodeImage = async (value: string, size: number = 120): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    // Find the QR code SVG element rendered in the DOM
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

export function PackageLabel({ order }: PackageLabelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { settings: labelSettings, isLoading: isLoadingSettings } = useLabelSettings();

  const canGenerateLabel = Boolean(order.tracking_id && order.shipment_id);
  const qrValue = order.tracking_id || order.id;

  const generatePDFFromTemplate = useCallback(async (): Promise<Uint8Array> => {
    // Fetch the template PDF
    const templateResponse = await fetch("/templates/shipping-label-template.pdf");
    const templateBytes = await templateResponse.arrayBuffer();
    
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const page = pages[0];
    
    // Embed fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Colors
    const black = rgb(0, 0, 0);
    const gray = rgb(0.3, 0.3, 0.3);
    
    // ============================================
    // FIXED FROM BLOCK - Static text (X:20, Y:320)
    // ============================================
    const fromX = 20;
    const fromY = 320;
    
    page.drawText("CanadaHarmControl", {
      x: fromX,
      y: fromY,
      size: 11,
      font: helveticaBold,
      color: black,
    });
    
    page.drawText("Healthcare Delivery Service", {
      x: fromX,
      y: fromY - 14,
      size: 9,
      font: helvetica,
      color: gray,
    });
    
    page.drawText("3265 Wharton Way #23", {
      x: fromX,
      y: fromY - 30,
      size: 9,
      font: helvetica,
      color: black,
    });
    
    page.drawText("Mississauga, ON L4X 2X9", {
      x: fromX,
      y: fromY - 42,
      size: 9,
      font: helvetica,
      color: black,
    });
    
    page.drawText("(647) 494-4538", {
      x: fromX,
      y: fromY - 56,
      size: 9,
      font: helvetica,
      color: black,
    });
    
    page.drawText("Info@endoverdose.ca", {
      x: fromX,
      y: fromY - 68,
      size: 9,
      font: helvetica,
      color: black,
    });
    
    page.drawText("www.endoverdose.ca", {
      x: fromX,
      y: fromY - 80,
      size: 9,
      font: helvetica,
      color: black,
    });
    
    // ============================================
    // SHIP TO BLOCK - Dynamic from order (X:20, Y:230)
    // ============================================
    const shipToX = 20;
    const shipToY = 230;
    
    page.drawText(order.client_name || "Customer", {
      x: shipToX,
      y: shipToY,
      size: 11,
      font: helveticaBold,
      color: black,
    });
    
    if (order.address_line_1) {
      page.drawText(order.address_line_1, {
        x: shipToX,
        y: shipToY - 14,
        size: 10,
        font: helvetica,
        color: black,
      });
    }
    
    if (order.address_line_2) {
      page.drawText(order.address_line_2, {
        x: shipToX,
        y: shipToY - 28,
        size: 10,
        font: helvetica,
        color: black,
      });
    }
    
    // ============================================
    // ORDER DATE (X:170, Y:300)
    // ============================================
    const orderDate = formatDate(order.order_date);
    page.drawText(orderDate, {
      x: 170,
      y: 300,
      size: 10,
      font: helvetica,
      color: black,
    });
    
    // ============================================
    // SHIPPED DATE & TIME (X:170, Y:280)
    // ============================================
    const shippedDate = formatDate(order.shipped_at);
    const shippedTime = formatTime(order.shipped_at);
    
    page.drawText(shippedDate, {
      x: 170,
      y: 280,
      size: 10,
      font: helvetica,
      color: black,
    });
    
    if (shippedTime) {
      page.drawText(shippedTime, {
        x: 170,
        y: 268,
        size: 8,
        font: helvetica,
        color: gray,
      });
    }
    
    // ============================================
    // SHIPMENT ID (X:170, Y:260)
    // ============================================
    page.drawText(order.shipment_id || "N/A", {
      x: 170,
      y: 250,
      size: 10,
      font: helveticaBold,
      color: black,
    });
    
    // ============================================
    // QR CODE (X:20, Y:70, Size:120x120)
    // ============================================
    try {
      const qrPngBytes = await generateQRCodeImage(qrValue, 120);
      const qrImage = await pdfDoc.embedPng(qrPngBytes);
      
      page.drawImage(qrImage, {
        x: 20,
        y: 70,
        width: 120,
        height: 120,
      });
    } catch (error) {
      console.error("Failed to embed QR code:", error);
    }
    
    // ============================================
    // TRACKING NUMBER (X:20, Y:40, Center aligned, Bold)
    // ============================================
    const trackingId = order.tracking_id || "N/A";
    const trackingWidth = helveticaBold.widthOfTextAtSize(trackingId, 14);
    const trackingCenterX = 20 + (248 - trackingWidth) / 2;
    
    page.drawText(trackingId, {
      x: trackingCenterX,
      y: 40,
      size: 14,
      font: helveticaBold,
      color: black,
    });
    
    return await pdfDoc.save() as unknown as Uint8Array;
  }, [order, qrValue]);

  const generatePDF = useCallback(async () => {
    setIsGenerating(true);
    try {
      const pdfBytes = await generatePDFFromTemplate();
      
      // Create download link
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
  }, [generatePDFFromTemplate, order.shipment_id, order.id, toast]);

  const printLabel = useCallback(async () => {
    setIsGenerating(true);
    try {
      const pdfBytes = await generatePDFFromTemplate();
      
      // Create blob URL for printing
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      
      // Open in new window for printing
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
        };
      }
      
      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      
    } catch (error) {
      console.error("Print error:", error);
      toast({ title: "Error", description: "Failed to print label", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [generatePDFFromTemplate, toast]);

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
          <p className="text-xs text-muted-foreground mt-1">Using template: Shipping_Label.pdf</p>
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
