import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Package, Truck, MapPin, CheckCircle, Clock, AlertCircle, 
  User, Phone, Mail, Calendar, Copy, Building, 
  FileText, Pill
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Order, Profile } from '@/types/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useToast } from '@/hooks/use-toast';

const timelineSteps = [
  { status: 'PENDING', label: 'Pending', icon: Clock },
  { status: 'CONFIRMED', label: 'Confirmed', icon: Package },
  { status: 'IN_ROUTE', label: 'In Route', icon: Truck },
  { status: 'ARRIVED', label: 'Arrived', icon: MapPin },
  { status: 'COMPLETED', label: 'Completed', icon: CheckCircle },
];

export default function AdminTracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [driver, setDriver] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (orderError) throw orderError;

      if (data) {
        setOrder(data as Order);
        
        // Fetch driver info if assigned
        if (data.assigned_driver_id) {
          const { data: driverProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.assigned_driver_id)
            .maybeSingle();
          
          if (driverProfile) {
            setDriver(driverProfile as Profile);
          }
        }
      } else {
        setError('Order not found.');
      }
    } catch (err) {
      setError('Failed to load order details.');
      console.error('Order fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Realtime subscription
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`admin-order-${orderId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          setOrder(payload.new as Order);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const formatDate = (date: string | null) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return null;
    return new Date(date).toLocaleString('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const copyTrackingUrl = () => {
    if (order?.tracking_url) {
      navigator.clipboard.writeText(order.tracking_url);
      toast({ title: "Copied", description: "Tracking URL copied to clipboard" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800';
      case 'IN_ROUTE': return 'bg-purple-100 text-purple-800';
      case 'ARRIVED': return 'bg-indigo-100 text-indigo-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'REQUEST_ADDRESS_REVIEW': return 'bg-red-100 text-red-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIndex = (status: string) => {
    return timelineSteps.findIndex(s => s.status === status);
  };

  const currentStatusIndex = order ? getStatusIndex(order.timeline_status) : -1;

  return (
    <AppLayout title="Order Tracking" showBackButton>
      <PullToRefresh onRefresh={fetchOrder}>
        <div className="p-4 space-y-4 pb-24">
          {isLoading && (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-muted-foreground mt-3">Loading order details...</p>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="p-4 text-center">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                <p className="text-destructive">{error}</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/orders')}>
                  Back to Orders
                </Button>
              </CardContent>
            </Card>
          )}

          {order && !isLoading && (
            <>
              {/* Status Header */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Shipment ID</p>
                      <p className="font-mono font-bold text-lg text-foreground">
                        {order.shipment_id || 'Not Assigned'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.timeline_status)}`}>
                      {order.timeline_status.replace('_', ' ')}
                    </span>
                  </div>
                  {order.tracking_url && (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-background/50 p-2 rounded truncate">
                        {order.tracking_url}
                      </code>
                      <Button variant="outline" size="sm" onClick={copyTrackingUrl}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Full Client Information */}
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-4">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    Client Information
                  </h4>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Full Name</p>
                        <p className="font-medium text-foreground">{order.name || 'N/A'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Date of Birth</p>
                        <p className="font-medium text-foreground">{formatDate(order.dob)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Health Card</p>
                        <p className="font-medium text-foreground">{order.health_card || 'N/A'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-medium text-foreground">
                          {order.phone_number ? (
                            <a href={`tel:${order.phone_number}`} className="text-primary underline">
                              {order.phone_number}
                            </a>
                          ) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium text-foreground break-all">
                          {order.email ? (
                            <a href={`mailto:${order.email}`} className="text-primary underline">
                              {order.email}
                            </a>
                          ) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {order.call_notes && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-yellow-600 font-medium">Call Notes</p>
                      <p className="text-sm text-yellow-900 mt-1">{order.call_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Full Address */}
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Complete Delivery Address
                  </h4>
                  <div className="p-4 bg-muted/50 rounded-lg space-y-1">
                    <p className="font-medium text-foreground">{order.address_1 || 'N/A'}</p>
                    {order.address_2 && (
                      <p className="text-foreground">{order.address_2}</p>
                    )}
                    <p className="text-foreground">
                      {order.city}, {order.province} {order.postal}
                    </p>
                    <p className="text-muted-foreground">{order.country || 'Canada'}</p>
                  </div>
                  
                  {order.address_1 && (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        const address = `${order.address_1}, ${order.city}, ${order.province} ${order.postal}`;
                        window.open(`https://maps.google.com/maps?q=${encodeURIComponent(address)}`, '_blank');
                      }}
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      Open in Google Maps
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Medication Details */}
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Pill className="w-4 h-4 text-primary" />
                    Medication Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Nasal Doses</p>
                      <p className="text-2xl font-bold text-foreground">{order.doses_nasal || 0}</p>
                      {order.nasal_rx && (
                        <p className="text-xs text-muted-foreground mt-1">Rx: {order.nasal_rx}</p>
                      )}
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Injectable Doses</p>
                      <p className="text-2xl font-bold text-foreground">{order.doses_injectable || 0}</p>
                      {order.injection_rx && (
                        <p className="text-xs text-muted-foreground mt-1">Rx: {order.injection_rx}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pharmacy & Authorization */}
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Building className="w-4 h-4 text-primary" />
                    Pharmacy Details
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Pharmacy Name</p>
                      <p className="font-medium text-foreground">{order.pharmacy_name || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Authorizing Pharmacist</p>
                      <p className="font-medium text-foreground">{order.authorizing_pharmacist || 'N/A'}</p>
                    </div>
                    {order.training_status && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Training Status</p>
                        <p className="font-medium text-foreground">{order.training_status}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Assigned Driver */}
              {driver && (
                <Card className="bg-card border-border">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Truck className="w-4 h-4 text-primary" />
                      Assigned Driver
                    </h4>
                    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{driver.full_name || 'Unknown'}</p>
                        {driver.phone && (
                          <a href={`tel:${driver.phone}`} className="text-sm text-primary underline">
                            {driver.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Timeline */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                    <Clock className="w-4 h-4 text-primary" />
                    Delivery Timeline
                  </h4>
                  <div className="space-y-4">
                    {timelineSteps.map((step, index) => {
                      const isCompleted = index <= currentStatusIndex;
                      const isCurrent = index === currentStatusIndex;
                      const Icon = step.icon;
                      
                      const timestamps: Record<string, string | null> = {
                        'PENDING': order.pending_at,
                        'CONFIRMED': order.confirmed_at,
                        'IN_ROUTE': order.in_route_at,
                        'ARRIVED': order.arrived_at,
                        'COMPLETED': order.completed_at,
                      };

                      return (
                        <div key={step.status} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            } ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            {index < timelineSteps.length - 1 && (
                              <div className={`w-0.5 h-8 mt-1 ${
                                isCompleted ? 'bg-primary' : 'bg-muted'
                              }`} />
                            )}
                          </div>
                          <div className="flex-1 pt-2">
                            <p className={`font-medium ${
                              isCompleted ? 'text-foreground' : 'text-muted-foreground'
                            }`}>
                              {step.label}
                            </p>
                            {timestamps[step.status] && (
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(timestamps[step.status])}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Status */}
              {order.delivery_status && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <p className="text-xs text-green-600 font-medium">Delivery Outcome</p>
                    <p className="font-semibold text-green-900 text-lg">
                      {order.delivery_status.replace(/_/g, ' ')}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}
