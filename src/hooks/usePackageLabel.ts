import { useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Order } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';

export function usePackageLabel() {
  const { toast } = useToast();

  const generatePDF = useCallback(async (order: Order): Promise<Blob | null> => {
    const labelElement = document.getElementById('package-label');
    
    if (!labelElement) {
      toast({
        title: "Error",
        description: "Label element not found",
        variant: "destructive"
      });
      return null;
    }

    try {
      // Capture the label as canvas
      const canvas = await html2canvas(labelElement, {
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      } as any);

      // Create PDF with 4x6 inch dimensions (thermal label size)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [4, 6]
      });

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 4, 6);

      return pdf.output('blob');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive"
      });
      return null;
    }
  }, [toast]);

  const downloadLabel = useCallback(async (order: Order) => {
    const blob = await generatePDF(order);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${order.tracking_id || order.shipment_id || 'label'}_${order.name?.replace(/\s+/g, '_') || 'package'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Downloaded",
        description: "Package label downloaded successfully"
      });
    }
  }, [generatePDF, toast]);

  const printLabel = useCallback(async (order: Order) => {
    const blob = await generatePDF(order);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      
      toast({
        title: "Print",
        description: "Opening print dialog..."
      });
    }
  }, [generatePDF, toast]);

  return {
    generatePDF,
    downloadLabel,
    printLabel
  };
}
