import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Filter, Download, FileDown, Printer, Check, X, Calendar, Pill } from "lucide-react";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import JsBarcode from "jsbarcode";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/useOrders";
import { useLabelSettings, type PackageLabelSettings } from "@/hooks/useLabelSettings";
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
}: {
  order: Order;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const canGenerateLabel = Boolean(order.tracking_id && order.shipment_id);

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
            disabled={!canGenerateLabel}
            className="shrink-0"
          />
          <CollapsibleTrigger asChild>
            <button className="flex-1 flex items-center justify-between text-left">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm truncate">{order.name || "Unknown"}</span>
                  {!canGenerateLabel && (
                    <Badge variant="outline" className="text-xs shrink-0">No Label</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatOrderDate(order.ship_date || order.created_at)}</span>
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
                <p className="text-foreground">{order.address_1 || "N/A"}</p>
                {order.city && <p className="text-foreground">{order.city}, {order.province}</p>}
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Postal</p>
                <p className="text-foreground">{order.postal || "N/A"}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Tracking ID</p>
                <p className="text-foreground font-mono">{order.tracking_id || "Not assigned"}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">RX</p>
                <p className="text-foreground">
                  {order.nasal_rx || order.injection_rx || "N/A"}
                </p>
              </div>
              {(order.doses_nasal || order.doses_injectable) && (
                <div className="col-span-2">
                  <p className="text-muted-foreground mb-1">Doses</p>
                  <div className="flex gap-2">
                    {order.doses_nasal && <Badge variant="secondary">Nasal: {order.doses_nasal}</Badge>}
                    {order.doses_injectable && <Badge variant="secondary">Injectable: {order.doses_injectable}</Badge>}
                  </div>
                </div>
              )}
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

  const address = [label.order.city, label.order.province, label.order.postal].filter(Boolean).join(", ");

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
          {/* Mini Label Preview */}
          <div className="bg-white rounded border p-2 mb-2">
            <div className="text-xs">
              <p className="font-bold text-black truncate">{label.order.name}</p>
              <p className="text-gray-600 truncate">{label.order.address_1}</p>
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

export default function PackageLabels() {
  const { orders, isLoading } = useOrders();
  const { settings: labelSettings, isLoading: isLoadingSettings } = useLabelSettings();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("orders");
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [generatedLabels, setGeneratedLabels] = useState<GeneratedLabel[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [singleDate, setSingleDate] = useState<Date | undefined>(undefined);
  const [rxFilter, setRxFilter] = useState("");

  // Filter orders that can have labels generated
  const labelReadyOrders = useMemo(() => {
    return orders.filter(order => order.tracking_id && order.shipment_id);
  }, [orders]);

  // Apply filters
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Date filter - single date
      if (singleDate) {
        const orderDate = order.ship_date || order.created_at;
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

      // Date filter - range
      if (dateRange.from && dateRange.to) {
        const orderDate = order.ship_date || order.created_at;
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

      // RX filter
      if (rxFilter.trim()) {
        const rx = rxFilter.toLowerCase();
        const nasalMatch = order.nasal_rx?.toLowerCase().includes(rx);
        const injectionMatch = order.injection_rx?.toLowerCase().includes(rx);
        if (!nasalMatch && !injectionMatch) {
          return false;
        }
      }

      return true;
    });
  }, [orders, singleDate, dateRange, rxFilter]);

  // Selection handlers
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

  const handleSelectAllOrders = useCallback(() => {
    const labelReadyFiltered = filteredOrders.filter(o => o.tracking_id && o.shipment_id);
    if (selectedOrderIds.size === labelReadyFiltered.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(labelReadyFiltered.map(o => o.id)));
    }
  }, [filteredOrders, selectedOrderIds.size]);

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

  // Generate labels for selected orders
  const generateLabels = useCallback(() => {
    const selectedOrders = orders.filter(o => selectedOrderIds.has(o.id));
    const newLabels: GeneratedLabel[] = selectedOrders.map(order => ({
      order,
      generatedAt: new Date(),
    }));
    
    setGeneratedLabels(prev => {
      // Avoid duplicates
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

  // Generate and download labels immediately
  const generateAndDownload = useCallback(async () => {
    const selectedOrders = orders.filter(o => selectedOrderIds.has(o.id));
    if (selectedOrders.length === 0) return;

    setIsGenerating(true);
    
    try {
      await downloadLabelsPDF(selectedOrders, labelSettings);
      
      // Also add to generated labels
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

  // Download selected labels from Labels tab
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

  // Clear filters
  const clearFilters = useCallback(() => {
    setDateRange({ from: undefined, to: undefined });
    setSingleDate(undefined);
    setRxFilter("");
  }, []);

  const hasActiveFilters = singleDate || dateRange.from || rxFilter.trim();
  const labelReadyFilteredCount = filteredOrders.filter(o => o.tracking_id && o.shipment_id).length;

  return (
    <AppLayout title="Package Labels">
      <div className="p-4 pb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
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
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                  <X className="w-3 h-3" />
                  Clear
                </Button>
              )}
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-4 border border-border">
                {/* Single Date */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Single Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                        {singleDate ? format(singleDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={singleDate}
                        onSelect={(date) => {
                          setSingleDate(date);
                          setDateRange({ from: undefined, to: undefined });
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date Range
                  </Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                          {dateRange.from ? format(dateRange.from, "MMM d") : "From"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => {
                            setDateRange(prev => ({ ...prev, from: date }));
                            setSingleDate(undefined);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                          {dateRange.to ? format(dateRange.to, "MMM d") : "To"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => {
                            setDateRange(prev => ({ ...prev, to: date }));
                            setSingleDate(undefined);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* RX Filter */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Pill className="w-4 h-4" />
                    Filter by RX
                  </Label>
                  <Input
                    placeholder="Enter RX number..."
                    value={rxFilter}
                    onChange={(e) => setRxFilter(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            )}

            {/* Select All & Actions */}
            <div className="flex items-center justify-between gap-2 py-2 border-b border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAllOrders}
                className="gap-2"
                disabled={labelReadyFilteredCount === 0}
              >
                <Checkbox
                  checked={selectedOrderIds.size === labelReadyFilteredCount && labelReadyFilteredCount > 0}
                  className="pointer-events-none"
                />
                {selectedOrderIds.size === labelReadyFilteredCount && labelReadyFilteredCount > 0 ? "Deselect All" : "Select All"}
                <span className="text-muted-foreground">({labelReadyFilteredCount})</span>
              </Button>
              
              {selectedOrderIds.size > 0 && (
                <Badge>{selectedOrderIds.size} selected</Badge>
              )}
            </div>

            {/* Order List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No orders found</p>
                {hasActiveFilters && (
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOrders.map(order => (
                  <OrderSelectCard
                    key={order.id}
                    order={order}
                    isSelected={selectedOrderIds.has(order.id)}
                    onSelect={(selected) => handleSelectOrder(order.id, selected)}
                  />
                ))}
              </div>
            )}

            {/* Action Buttons */}
            {selectedOrderIds.size > 0 && (
              <div className="fixed bottom-20 left-4 right-4 bg-card border border-border rounded-lg p-3 shadow-lg z-30">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={generateLabels}
                    disabled={isGenerating}
                  >
                    <FileDown className="w-4 h-4" />
                    Generate Labels
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={generateAndDownload}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Generate & Download
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Labels Tab */}
          <TabsContent value="labels" className="space-y-4">
            {generatedLabels.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileDown className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No labels generated yet</p>
                <p className="text-sm mt-1">Select orders and generate labels first</p>
              </div>
            ) : (
              <>
                {/* Select All & Actions */}
                <div className="flex items-center justify-between gap-2 py-2 border-b border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllLabels}
                    className="gap-2"
                  >
                    <Checkbox
                      checked={selectedLabelIds.size === generatedLabels.length && generatedLabels.length > 0}
                      className="pointer-events-none"
                    />
                    {selectedLabelIds.size === generatedLabels.length ? "Deselect All" : "Select All"}
                    <span className="text-muted-foreground">({generatedLabels.length})</span>
                  </Button>
                  
                  {selectedLabelIds.size > 0 && (
                    <Badge>{selectedLabelIds.size} selected</Badge>
                  )}
                </div>

                {/* Labels Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {generatedLabels.map(label => (
                    <LabelCard
                      key={label.order.id}
                      label={label}
                      isSelected={selectedLabelIds.has(label.order.id)}
                      onSelect={(selected) => handleSelectLabel(label.order.id, selected)}
                    />
                  ))}
                </div>

                {/* Export Actions */}
                {selectedLabelIds.size > 0 && (
                  <div className="fixed bottom-20 left-4 right-4 bg-card border border-border rounded-lg p-3 shadow-lg z-30">
                    <Button
                      className="w-full gap-2"
                      onClick={downloadSelectedLabels}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Export {selectedLabelIds.size} Label{selectedLabelIds.size > 1 ? "s" : ""} as PDF
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// Helper function to generate PDF for multiple orders
async function downloadLabelsPDF(orders: Order[], labelSettings: PackageLabelSettings) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: [4, 6],
  });

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    
    if (i > 0) {
      pdf.addPage([4, 6]);
    }

    // Create a temporary container for the label
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    document.body.appendChild(container);

    // Create the label HTML
    const address = [order.city, order.province, order.postal].filter(Boolean).join(", ");
    const formatDate = (date: string | null): string => {
      if (!date) return "N/A";
      return new Date(date).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };

    container.innerHTML = `
      <div style="width: 384px; height: 576px; padding: 16px; background-color: #ffffff; font-family: system-ui, -apple-system, sans-serif;">
        <div style="height: 12px; background-color: #F97316; margin: -16px -16px 12px -16px;"></div>
        
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #d1d5db; padding-bottom: 10px; margin-bottom: 10px;">
          <div>
            <p style="font-size: 10px; font-weight: bold; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">FROM</p>
            <p style="font-size: 14px; font-weight: 600; color: #000000; margin-bottom: 1px;">${labelSettings.from_company}</p>
            <p style="font-size: 11px; color: #374151; margin-bottom: 1px;">${labelSettings.from_tagline}</p>
            <p style="font-size: 9px; color: #6b7280;">${labelSettings.from_website}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 10px; font-weight: bold; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">CONTACT</p>
            <p style="font-size: 11px; color: #000000; margin-bottom: 1px;">${labelSettings.contact_address}</p>
            <p style="font-size: 11px; color: #000000; margin-bottom: 1px;">${labelSettings.contact_phone}</p>
            <p style="font-size: 10px; color: #374151;">${labelSettings.contact_email}</p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #d1d5db; padding-bottom: 10px; margin-bottom: 10px;">
          <div>
            <p style="font-size: 10px; font-weight: bold; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Shipment ID</p>
            <p style="font-size: 14px; font-family: monospace; font-weight: bold; color: #000000;">${order.shipment_id}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 10px; font-weight: bold; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Ship Date</p>
            <p style="font-size: 13px; font-weight: 600; color: #000000;">${formatDate(order.ship_date)}</p>
          </div>
        </div>

        <div style="margin-bottom: 10px;">
          <div style="background-color: #dc2626; border: 2px solid #b91c1c; border-radius: 4px; padding: 4px 8px; display: inline-block;">
            <span style="color: #ffffff; font-size: 9px; font-weight: bold;">⚠️ FRAGILE</span>
          </div>
        </div>

        <div style="background-color: #000000; border-radius: 4px; padding: 4px 8px; display: inline-block; margin-bottom: 8px;">
          <span style="color: #ffffff; font-size: 10px; font-weight: bold; letter-spacing: 0.5px;">SHIP TO</span>
        </div>

        <div style="margin-bottom: 4px;">
          <p style="font-size: 16px; font-weight: bold; color: #000000; margin: 0;">${order.name || "Customer"}</p>
          <p style="font-size: 13px; color: #000000; margin: 2px 0;">${order.address_1 || ""}</p>
          ${order.address_2 ? `<p style="font-size: 13px; color: #000000; margin: 2px 0;">${order.address_2}</p>` : ""}
          <p style="font-size: 13px; color: #000000; margin: 2px 0;">${address}</p>
        </div>

        <div style="border-top: 1px solid #d1d5db; padding-top: 10px; margin-top: auto;">
          <p style="font-size: 10px; font-weight: bold; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; margin-bottom: 6px;">TRACKING #</p>
          <div style="display: flex; justify-content: center;">
            <svg id="barcode-${i}" style="max-width: 280px; width: 100%;"></svg>
          </div>
        </div>
      </div>
    `;

    // Generate barcode
    const barcodeSvg = container.querySelector(`#barcode-${i}`);
    if (barcodeSvg && order.tracking_id) {
      JsBarcode(barcodeSvg, order.tracking_id, BARCODE_CONFIG);
    }

    // Render to canvas and add to PDF
    const canvas = await html2canvas(container.firstElementChild as HTMLElement, CANVAS_OPTIONS);
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 4, 6);

    // Cleanup
    document.body.removeChild(container);
  }

  pdf.save(`labels-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`);
}
