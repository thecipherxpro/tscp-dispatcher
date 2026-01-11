import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Filter, Download, FileDown, Printer, Check, X, Calendar, Pill, Tag } from "lucide-react";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import JsBarcode from "jsbarcode";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useOrders, generateTrackingForOrders } from "@/hooks/useOrders";
import { useLabelSettings, type PackageLabelSettings } from "@/hooks/useLabelSettings";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Order } from "@/types/auth";
import { cn } from "@/lib/utils";

interface GeneratedLabel {
  order: Order;
  generatedAt: Date;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const formatOrderDate = (date: string | null): string => {
  if (!date) return "N/A";
  return format(new Date(date), "MMM d, yyyy");
};

const BARCODE_CONFIG = {
  format: "CODE128",
  width: 2,
  height: 60,
  displayValue: true,
  fontSize: 14,
  margin: 10,
  background: "#ffffff",
  lineColor: "#000000",
} as const;

const CANVAS_OPTIONS = {
  scale: 3,
  backgroundColor: "#ffffff",
  useCORS: true,
  logging: false,
};

// Collapsible Order Card Component
function OrderSelectCard({
  order,
  isSelected,
  onSelect,
  allowWithoutTracking = false,
}: {
  order: Order;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  allowWithoutTracking?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const hasTracking = Boolean(order.tracking_id && order.shipment_id);
  const canSelect = allowWithoutTracking || hasTracking;

  return (
    <div className={cn(
      "border rounded-lg bg-card transition-colors",
      isSelected ? "border-primary bg-primary/5" : "border-border"
    )}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-3 p-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            disabled={!canSelect}
            className="shrink-0"
          />
          <CollapsibleTrigger asChild>
            <button className="flex-1 flex items-center justify-between text-left">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm truncate">{order.client_name || "Unknown"}</span>
                  {!hasTracking && (
                    <Badge variant="outline" className="text-xs shrink-0">No Tracking</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatOrderDate(order.shipping_date || order.created_at)}</span>
                  {order.shipment_id && (
                    <span className="font-mono">{order.shipment_id}</span>
                  )}
                </div>
              </div>
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t border-border/50">
            <div className="grid grid-cols-2 gap-3 text-xs mt-3">
              <div>
                <p className="text-muted-foreground mb-1">Address</p>
                <p className="text-foreground">{order.address_line_1 || "N/A"}</p>
                {order.geo_zone && <p className="text-foreground">{order.geo_zone}</p>}
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Warehouse</p>
                <p className="text-foreground">{order.warehouse_address || "N/A"}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Tracking ID</p>
                <p className="text-foreground font-mono">{order.tracking_id || "Not assigned"}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">RX</p>
                <p className="text-foreground">
                  {order.nasal_rx_number || order.injection_rx_number || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Single Label Card for Labels Tab
function LabelCard({
  label,
  isSelected,
  onSelect,
}: {
  label: GeneratedLabel;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
}) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && label.order.tracking_id) {
      try {
        JsBarcode(barcodeRef.current, label.order.tracking_id, {
          ...BARCODE_CONFIG,
          height: 40,
          fontSize: 10,
        });
      } catch (error) {
        console.error("Barcode generation error:", error);
      }
    }
  }, [label.order.tracking_id]);

  const address = label.order.geo_zone || label.order.address_line_1 || "";

  return (
    <div className={cn(
      "border rounded-lg bg-card overflow-hidden transition-colors",
      isSelected ? "border-primary ring-2 ring-primary/20" : "border-border"
    )}>
      <div className="flex items-start gap-3 p-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="shrink-0 mt-1"
        />
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded border p-2 mb-2">
            <div className="text-xs">
              <p className="font-bold text-black truncate">{label.order.client_name}</p>
              <p className="text-gray-600 truncate">{label.order.address_line_1}</p>
              <p className="text-gray-600 truncate">{address}</p>
            </div>
            <div className="flex justify-center mt-2">
              <svg ref={barcodeRef} style={{ maxWidth: "150px", width: "100%", height: "50px" }} />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono">{label.order.shipment_id}</span>
            <span>{format(label.generatedAt, "MMM d, h:mm a")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// PDF generation helper function
async function downloadLabelsPDF(orders: Order[], labelSettings: PackageLabelSettings) {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [100, 150] // 4x6 inch label
  });

  for (let i = 0; i < orders.length; i++) {
    if (i > 0) {
      pdf.addPage([100, 150], 'landscape');
    }
    
    const order = orders[i];
    
    // Add label content
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(labelSettings.from_company, 10, 15);
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(labelSettings.from_tagline, 10, 20);
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TO:', 10, 35);
    
    pdf.setFont('helvetica', 'normal');
    pdf.text(order.client_name || 'Unknown', 10, 42);
    pdf.text(order.address_line_1 || '', 10, 48);
    pdf.text(order.geo_zone || '', 10, 54);
    
    if (order.tracking_id) {
      pdf.setFontSize(8);
      pdf.text(`Tracking: ${order.tracking_id}`, 10, 70);
    }
    
    if (order.shipment_id) {
      pdf.text(`Shipment: ${order.shipment_id}`, 10, 76);
    }
  }
  
  pdf.save(`labels-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`);
}

export default function PackageLabels() {
  const { orders, isLoading, refetch } = useOrders();
  const { settings: labelSettings, isLoading: isLoadingSettings } = useLabelSettings();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [activeTab, setActiveTab] = useState("orders");
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [generatedLabels, setGeneratedLabels] = useState<GeneratedLabel[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingTracking, setIsGeneratingTracking] = useState(false);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [singleDate, setSingleDate] = useState<Date | undefined>(undefined);
  const [rxFilter, setRxFilter] = useState("");

  // Filter orders that can have labels generated (have tracking)
  const labelReadyOrders = useMemo(() => {
    return orders.filter(order => order.tracking_id && order.shipment_id);
  }, [orders]);

  // Filter orders that need tracking generated
  const ordersNeedingTracking = useMemo(() => {
    return orders.filter(order => !order.tracking_id || !order.shipment_id);
  }, [orders]);

  // Apply filters
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (singleDate) {
        const orderDate = order.shipping_date || order.created_at;
        if (orderDate) {
          const orderDateParsed = parseISO(orderDate);
          if (!isWithinInterval(orderDateParsed, {
            start: startOfDay(singleDate),
            end: endOfDay(singleDate)
          })) {
            return false;
          }
        }
      }

      if (dateRange.from && dateRange.to) {
        const orderDate = order.shipping_date || order.created_at;
        if (orderDate) {
          const orderDateParsed = parseISO(orderDate);
          if (!isWithinInterval(orderDateParsed, {
            start: startOfDay(dateRange.from),
            end: endOfDay(dateRange.to)
          })) {
            return false;
          }
        }
      }

      if (rxFilter.trim()) {
        const rx = rxFilter.toLowerCase();
        const nasalMatch = order.nasal_rx_number?.toLowerCase().includes(rx);
        const injectionMatch = order.injection_rx_number?.toLowerCase().includes(rx);
        if (!nasalMatch && !injectionMatch) {
          return false;
        }
      }

      return true;
    });
  }, [orders, singleDate, dateRange, rxFilter]);

  const handleSelectOrder = useCallback((orderId: string, selected: boolean) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(orderId);
      } else {
        next.delete(orderId);
      }
      return next;
    });
  }, []);

  const handleSelectAllOrders = useCallback((includeWithoutTracking = false) => {
    const selectableOrders = includeWithoutTracking 
      ? filteredOrders 
      : filteredOrders.filter(o => o.tracking_id && o.shipment_id);
    
    if (selectedOrderIds.size === selectableOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(selectableOrders.map(o => o.id)));
    }
  }, [filteredOrders, selectedOrderIds.size]);

  const handleGenerateTracking = useCallback(async () => {
    const selectedOrders = orders.filter(o => selectedOrderIds.has(o.id) && (!o.tracking_id || !o.shipment_id));
    if (selectedOrders.length === 0) {
      toast({
        title: "No orders need tracking",
        description: "All selected orders already have tracking IDs.",
      });
      return;
    }

    setIsGeneratingTracking(true);
    
    try {
      const result = await generateTrackingForOrders(selectedOrders);
      
      toast({
        title: "Tracking Generated",
        description: `Generated tracking for ${result.success} order(s).${result.failed > 0 ? ` ${result.failed} failed.` : ''}`,
      });
      
      setSelectedOrderIds(new Set());
      refetch();
    } catch (error) {
      console.error("Error generating tracking:", error);
      toast({
        title: "Error",
        description: "Failed to generate tracking",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingTracking(false);
    }
  }, [orders, selectedOrderIds, toast, refetch]);

  const handleSelectLabel = useCallback((orderId: string, selected: boolean) => {
    setSelectedLabelIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(orderId);
      } else {
        next.delete(orderId);
      }
      return next;
    });
  }, []);

  const handleSelectAllLabels = useCallback(() => {
    if (selectedLabelIds.size === generatedLabels.length) {
      setSelectedLabelIds(new Set());
    } else {
      setSelectedLabelIds(new Set(generatedLabels.map(l => l.order.id)));
    }
  }, [generatedLabels, selectedLabelIds.size]);

  const generateLabels = useCallback(() => {
    const selectedOrders = orders.filter(o => selectedOrderIds.has(o.id));
    const newLabels: GeneratedLabel[] = selectedOrders.map(order => ({
      order,
      generatedAt: new Date(),
    }));
    
    setGeneratedLabels(prev => {
      const existingIds = new Set(prev.map(l => l.order.id));
      const uniqueNew = newLabels.filter(l => !existingIds.has(l.order.id));
      return [...prev, ...uniqueNew];
    });
    
    setSelectedOrderIds(new Set());
    setActiveTab("labels");
    
    toast({
      title: "Labels Generated",
      description: `${newLabels.length} label(s) ready for download`,
    });
  }, [orders, selectedOrderIds, toast]);

  const generateAndDownload = useCallback(async () => {
    const selectedOrders = orders.filter(o => selectedOrderIds.has(o.id));
    if (selectedOrders.length === 0) return;

    setIsGenerating(true);
    
    try {
      await downloadLabelsPDF(selectedOrders, labelSettings);
      
      const newLabels: GeneratedLabel[] = selectedOrders.map(order => ({
        order,
        generatedAt: new Date(),
      }));
      
      setGeneratedLabels(prev => {
        const existingIds = new Set(prev.map(l => l.order.id));
        const uniqueNew = newLabels.filter(l => !existingIds.has(l.order.id));
        return [...prev, ...uniqueNew];
      });
      
      setSelectedOrderIds(new Set());
      
      toast({
        title: "Labels Downloaded",
        description: `${selectedOrders.length} label(s) downloaded as PDF`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Error",
        description: "Failed to download labels",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [orders, selectedOrderIds, labelSettings, toast]);

  const downloadSelectedLabels = useCallback(async () => {
    const selectedLabels = generatedLabels.filter(l => selectedLabelIds.has(l.order.id));
    if (selectedLabels.length === 0) return;

    setIsGenerating(true);
    
    try {
      await downloadLabelsPDF(selectedLabels.map(l => l.order), labelSettings);
      setSelectedLabelIds(new Set());
      
      toast({
        title: "Labels Downloaded",
        description: `${selectedLabels.length} label(s) downloaded as PDF`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Error",
        description: "Failed to download labels",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [generatedLabels, selectedLabelIds, labelSettings, toast]);

  const clearFilters = useCallback(() => {
    setDateRange({ from: undefined, to: undefined });
    setSingleDate(undefined);
    setRxFilter("");
  }, []);

  const hasActiveFilters = singleDate || dateRange.from || rxFilter.trim();

  return (
    <AdminLayout title="Package Labels" showBackButton={isMobile}>
      <div className={isMobile ? "p-4 pb-24" : "p-6 lg:p-8"}>
        {!isMobile && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">Package Labels</h2>
            <p className="text-muted-foreground">Generate and download shipping labels</p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4 max-w-md">
            <TabsTrigger value="orders" className="gap-2">
              Orders
              {labelReadyOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1">{labelReadyOrders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="labels" className="gap-2">
              Labels
              {generatedLabels.length > 0 && (
                <Badge variant="secondary" className="ml-1">{generatedLabels.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            {/* Filter Toggle */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
                {hasActiveFilters && <Badge className="ml-1 h-5 w-5 p-0 justify-center">!</Badge>}
              </Button>
              
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Single Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <Calendar className="mr-2 h-4 w-4" />
                            {singleDate ? format(singleDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={singleDate}
                            onSelect={setSingleDate}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>RX Number</Label>
                      <Input
                        placeholder="Search RX..."
                        value={rxFilter}
                        onChange={(e) => setRxFilter(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selection Actions */}
            {selectedOrderIds.size > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{selectedOrderIds.size} orders selected</p>
                    <p className="text-sm text-muted-foreground">Ready to generate labels</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={generateLabels}>
                      Generate Labels
                    </Button>
                    <Button onClick={generateAndDownload} disabled={isGenerating}>
                      {isGenerating ? "Generating..." : "Download PDF"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Orders List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Tag className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-foreground font-medium">No orders found</p>
                </CardContent>
              </Card>
            ) : (
              <div className={isMobile ? "space-y-3" : "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"}>
                {filteredOrders.map((order) => (
                  <OrderSelectCard
                    key={order.id}
                    order={order}
                    isSelected={selectedOrderIds.has(order.id)}
                    onSelect={(selected) => handleSelectOrder(order.id, selected)}
                    allowWithoutTracking={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Labels Tab */}
          <TabsContent value="labels" className="space-y-4">
            {selectedLabelIds.size > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <p className="font-medium">{selectedLabelIds.size} labels selected</p>
                  <Button onClick={downloadSelectedLabels} disabled={isGenerating}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Selected
                  </Button>
                </CardContent>
              </Card>
            )}

            {generatedLabels.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileDown className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-foreground font-medium">No labels generated</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select orders and generate labels to see them here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className={isMobile ? "space-y-3" : "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"}>
                {generatedLabels.map((label) => (
                  <LabelCard
                    key={label.order.id}
                    label={label}
                    isSelected={selectedLabelIds.has(label.order.id)}
                    onSelect={(selected) => handleSelectLabel(label.order.id, selected)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
