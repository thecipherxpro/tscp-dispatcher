import { useEffect, useRef, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import JsBarcode from "jsbarcode";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import type { Order } from "@/types/auth";
import { useToast } from "@/hooks/use-toast";

interface PackageLabelProps {
  order: Order;
}

export function PackageLabel({ order }: PackageLabelProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (barcodeRef.current && order.tracking_id) {
      try {
        JsBarcode(barcodeRef.current, order.tracking_id, {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 10,
          background: "#ffffff",
          lineColor: "#000000",
        });
      } catch (error) {
        console.error("Barcode generation error:", error);
      }
    }
  }, [order.tracking_id]);

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const generatePDF = async () => {
    if (!labelRef.current) return;

    setIsGenerating(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = await html2canvas(labelRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
      } as any);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "in",
        format: [4, 6],
      });

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, 4, 6);
      pdf.save(`label-${order.shipment_id || order.id}.pdf`);

      toast({
        title: "Label Downloaded",
        description: "Package label PDF has been downloaded",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error",
        description: "Failed to generate label PDF",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const printLabel = async () => {
    if (!labelRef.current) return;

    setIsGenerating(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = await html2canvas(labelRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
      } as any);

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Package Label - ${order.shipment_id || order.id}</title>
              <style>
                @page { size: 4in 6in; margin: 0; }
                body { margin: 0; padding: 0; }
                img { width: 4in; height: 6in; }
              </style>
            </head>
            <body>
              <img src="${canvas.toDataURL("image/png")}" />
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    } catch (error) {
      console.error("Print error:", error);
      toast({
        title: "Error",
        description: "Failed to print label",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerateLabel = order.tracking_id && order.shipment_id;

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
      <div className="bg-background rounded-xl border border-border overflow-hidden">
        <div ref={labelRef} className="bg-white p-4" style={{ width: "100%", aspectRatio: "4/6" }}>
          <div className="bg-primary h-3 -mx-4 -mt-4 mb-3" />

          <div className="border-b border-border pb-3 mb-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">FROM</p>
            <p className="text-sm font-semibold text-foreground">{order.pharmacy_name || "PharmaNet Pharmacy"}</p>
            <p className="text-xs text-muted-foreground">Healthcare Delivery Service</p>
          </div>

          <div className="flex justify-between items-center border-b border-border pb-3 mb-3">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Shipment ID</p>
              <p className="text-base font-mono font-bold text-foreground">{order.shipment_id}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Ship Date</p>
              <p className="text-sm font-medium text-foreground">{formatDate(order.ship_date)}</p>
            </div>
          </div>

          <div className="mb-4">
            <p style={{ fontSize: "10px", fontWeight: "bold", color: "#ffffff", backgroundColor: "#000000", padding: "4px 8px", borderRadius: "4px", letterSpacing: "0.5px", marginBottom: "8px", display: "inline-block" }}>SHIP TO</p>
            <p className="text-lg font-bold" style={{ color: "#000000" }}>{order.name || "Customer"}</p>
            <p className="text-sm" style={{ color: "#000000" }}>{order.address_1 || ""}</p>
            {order.address_2 && <p className="text-sm text-foreground">{order.address_2}</p>}
            <p className="text-sm text-foreground">
              {[order.city, order.province, order.postal].filter(Boolean).join(", ")}
            </p>
          </div>

          <div className="border-t border-border pt-3 mt-auto">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide text-center mb-2">
              TRACKING #
            </p>
            <div className="flex justify-center">
              <svg ref={barcodeRef} className="w-full max-w-[280px]" />
            </div>
          </div>
        </div>
      </div>

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
