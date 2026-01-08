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
    const { width, height } = page.getSize();
    
    // Embed fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Colors
    const black = rgb(0, 0, 0);
    const gray = rgb(0.3, 0.3, 0.3);
    
    // Calculate positions based on template layout (4x6 inch label = 288x432 points)
    // Template areas based on visual inspection:
    // - Header: Top section with logo
    // - SHIP TO: Left column, upper section
    // - FROM: Right column, upper section  
    // - FRAGILE/Handle icons: Left column, middle section
    // - TRACKING#: Right column, middle section
    // - SCAN TO TRACK + QR: Left column, bottom section
    // - ORDER DATE & SHIPMENT ID: Right column, bottom section
    
    // SHIP TO section (left column) - Customer details
    const shipToX = 30;
    const shipToY = height - 140; // Below header
    
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
    
    page.drawText(order.country || "Canada", {
      x: shipToX,
      y: shipToY - (order.address_line_2 ? 42 : 28),
      size: 10,
      font: helvetica,
      color: black,
    });
    
    // FROM section (right column) - Sender details
    const fromX = width / 2 + 20;
    const fromY = height - 100;
    
    page.drawText(labelSettings.from_company || "Canada Harm Control", {
      x: fromX,
      y: fromY,
      size: 10,
      font: helveticaBold,
      color: black,
    });
    
    page.drawText(labelSettings.from_tagline || "EndOverdose.ca", {
      x: fromX,
      y: fromY - 12,
      size: 9,
      font: helvetica,
      color: gray,
    });
    
    page.drawText(labelSettings.contact_address || "", {
      x: fromX,
      y: fromY - 26,
      size: 8,
      font: helvetica,
      color: gray,
    });
    
    page.drawText(labelSettings.contact_phone || "", {
      x: fromX,
      y: fromY - 38,
      size: 8,
      font: helvetica,
      color: gray,
    });
    
    // TRACKING# section (right column, middle)
    const trackingX = width / 2 + 20;
    const trackingY = height - 250;
    
    page.drawText(order.tracking_id || "N/A", {
      x: trackingX,
      y: trackingY,
      size: 12,
      font: helveticaBold,
      color: black,
    });
    
    // ORDER DATE section (right column, bottom)
    const orderDateX = width / 2 + 20;
    const orderDateY = height - 340;
    
    const shippedDate = formatDate(order.shipped_at);
    const shippedTime = formatTime(order.shipped_at);
    
    page.drawText(shippedDate, {
      x: orderDateX + 80,
      y: orderDateY,
      size: 10,
      font: helvetica,
      color: black,
    });
    
    if (shippedTime) {
      page.drawText(shippedTime, {
        x: orderDateX + 80,
        y: orderDateY - 12,
        size: 8,
        font: helvetica,
        color: gray,
      });
    }
    
    // SHIPMENT ID section
    page.drawText(order.shipment_id || "N/A", {
      x: orderDateX + 80,
      y: orderDateY - 30,
      size: 10,
      font: helveticaBold,
      color: black,
    });
    
    // Generate and embed QR code
    try {
      const qrPngBytes = await generateQRCodeImage(qrValue, 120);
      const qrImage = await pdfDoc.embedPng(qrPngBytes);
      
      // QR code position (left column, bottom section - below "SCAN TO TRACK")
      const qrX = 80;
      const qrY = height - 420;
      const qrSize = 80;
      
      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });
    } catch (error) {
      console.error("Failed to embed QR code:", error);
    }
    
    return await pdfDoc.save() as unknown as Uint8Array;
  }, [order, labelSettings, qrValue]);

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
              <p className="font-medium">{labelSettings.from_company}</p>
              <p className="text-muted-foreground text-xs">{labelSettings.from_tagline}</p>
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
