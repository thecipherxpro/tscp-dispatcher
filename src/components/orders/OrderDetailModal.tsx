import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Package, Truck, Clock, Copy, ExternalLink, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Order } from '@/types/auth';
import { DriverAssignmentModal } from './DriverAssignmentModal';
import { useToast } from '@/hooks/use-toast';

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  isAdmin?: boolean;
}

export function OrderDetailModal({ order, isOpen, onClose, onUpdate, isAdmin = false }: OrderDetailModalProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showAssignModal, setShowAssignModal] = useState(false);

  if (!order) return null;

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
    if (order.tracking_url) {
      navigator.clipboard.writeText(order.tracking_url);
      toast({ title: "Copied", description: "Tracking URL copied to clipboard" });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Order Details</DialogTitle>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.timeline_status)}`}>
                {order.timeline_status.replace('_', ' ')}
              </span>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Shipment Info */}
            {order.shipment_id && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Shipment ID</p>
                      <p className="font-mono font-medium text-foreground">{order.shipment_id}</p>
                    </div>
                    {order.tracking_url && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={copyTrackingUrl}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Client Info */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Client Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-foreground">{order.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">DOB</p>
                    <p className="text-foreground">{formatDate(order.dob)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-foreground">{order.phone_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-foreground truncate">{order.email || 'N/A'}</p>
                  </div>
                </div>
                {order.call_notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-foreground text-sm">{order.call_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Address */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-2">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Delivery Address
                </h4>
                <div className="text-sm text-foreground">
                  <p>{order.address_1}</p>
                  {order.address_2 && <p>{order.address_2}</p>}
                  <p>{order.city}, {order.province} {order.postal}</p>
                  <p>{order.country || 'Canada'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Medication Info */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-2">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Medication
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {(order.doses_nasal || order.nasal_rx) && (
                    <div>
                      <p className="text-xs text-muted-foreground">Nasal</p>
                      <p className="text-foreground">
                        {order.doses_nasal || 0} doses
                        {order.nasal_rx && <span className="text-muted-foreground"> ({order.nasal_rx})</span>}
                      </p>
                    </div>
                  )}
                  {(order.doses_injectable || order.injection_rx) && (
                    <div>
                      <p className="text-xs text-muted-foreground">Injectable</p>
                      <p className="text-foreground">
                        {order.doses_injectable || 0} doses
                        {order.injection_rx && <span className="text-muted-foreground"> ({order.injection_rx})</span>}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-2">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Timeline
                </h4>
                <div className="space-y-2 text-sm">
                  {order.pending_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="text-foreground">{formatDateTime(order.pending_at)}</span>
                    </div>
                  )}
                  {order.confirmed_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Confirmed</span>
                      <span className="text-foreground">{formatDateTime(order.confirmed_at)}</span>
                    </div>
                  )}
                  {order.in_route_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">In Route</span>
                      <span className="text-foreground">{formatDateTime(order.in_route_at)}</span>
                    </div>
                  )}
                  {order.arrived_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Arrived</span>
                      <span className="text-foreground">{formatDateTime(order.arrived_at)}</span>
                    </div>
                  )}
                  {order.completed_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="text-foreground">{formatDateTime(order.completed_at)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Delivery Status */}
            {order.delivery_status && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <p className="text-xs text-green-600">Delivery Outcome</p>
                  <p className="font-medium text-green-900">
                    {order.delivery_status.replace(/_/g, ' ')}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Admin Actions */}
            {isAdmin && (
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => {
                    onClose();
                    navigate(`/admin/tracking/${order.id}`);
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Full Details
                </Button>
                
                {order.timeline_status === 'PENDING' && (
                  <Button className="w-full" onClick={() => setShowAssignModal(true)}>
                    <Truck className="w-4 h-4 mr-2" />
                    Assign Driver
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DriverAssignmentModal
        order={order}
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onSuccess={() => {
          setShowAssignModal(false);
          onUpdate();
          onClose();
        }}
      />
    </>
  );
}
