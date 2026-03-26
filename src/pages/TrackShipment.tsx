import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams, Link } from 'react-router-dom';
import { Package, Truck, CheckCircle, Clock, AlertCircle, Search, ArrowLeft, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { PublicTracking } from '@/types/auth';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import endoverdoseLogo from '@/assets/endoverdose-logo.png';

const timelineSteps = [
  { status: 'PENDING', label: 'Order Received', description: 'Your prescription order has been received and is being prepared.', icon: Clock },
  { status: 'PICKED_UP_AND_ASSIGNED', label: 'Picked Up', description: 'A driver has picked up your package from the pharmacy.', icon: Package },
  { status: 'IN_ROUTE', label: 'On The Way', description: 'Your delivery is in transit to your address.', icon: Truck },
  { status: 'COMPLETED', label: 'Delivered', description: 'Your package has been delivered successfully.', icon: CheckCircle },
];

const getPublicStatusIndex = (status: string) => {
  switch (status) {
    case 'PENDING': return 0;
    case 'PICKED_UP_AND_ASSIGNED':
    case 'REVIEW_REQUESTED':
    case 'CONFIRMED': return 1;
    case 'IN_ROUTE': return 2;
    case 'COMPLETED_DELIVERED':
    case 'COMPLETED_INCOMPLETE': return 3;
    default: return -1;
  }
};

export default function TrackShipment() {
  const [searchParams] = useSearchParams();
  const { trackingId: pathTrackingId } = useParams();
  const navigate = useNavigate();
  const trackingId = pathTrackingId || searchParams.get('tracking');

  const [tracking, setTracking] = useState<PublicTracking | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(trackingId || '');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const haptic = useHapticFeedback();

  const fetchTracking = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: rpcData, error } = await supabase
        .rpc('get_public_tracking', { p_tracking_id: id });
      if (error) throw error;
      const data = rpcData?.[0] || null;
      if (data) {
        setTracking(data as PublicTracking);
        setLastUpdated(new Date());
      } else {
        setError('No shipment found with that tracking ID. Please double-check and try again.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again in a moment.');
      console.error('Tracking error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (trackingId) fetchTracking(trackingId);
  }, [trackingId, fetchTracking]);

  useEffect(() => {
    if (!trackingId) return;
    const channel = supabase
      .channel(`tracking-${trackingId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'public_tracking',
        filter: `tracking_id=eq.${trackingId}`
      }, (payload) => {
        setTracking(payload.new as PublicTracking);
        setLastUpdated(new Date());
        haptic.success();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [trackingId, haptic]);

  const handleRefresh = async () => {
    if (tracking?.tracking_id) await fetchTracking(tracking.tracking_id);
  };

  const handleSearch = () => {
    const id = searchInput.trim();
    if (id) {
      navigate(`/track/${id}`);
      fetchTracking(id);
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleString('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const currentStatusIndex = tracking ? getPublicStatusIndex(tracking.timeline_status) : -1;
  const isIncomplete = tracking?.timeline_status === 'COMPLETED_INCOMPLETE';
  const isDelivered = tracking?.timeline_status === 'COMPLETED_DELIVERED';

  const getTimestamp = (stepStatus: string) => {
    if (!tracking) return null;
    switch (stepStatus) {
      case 'PENDING': return tracking.pending_at;
      case 'PICKED_UP_AND_ASSIGNED': return tracking.picked_up_at || tracking.assigned_at;
      case 'IN_ROUTE': return tracking.shipped_at;
      case 'COMPLETED': return tracking.completed_at;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src={endoverdoseLogo} alt="TSCP" className="h-8 w-8 rounded-lg" />
              <span className="font-bold text-foreground">TSCP Dispatch</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <PullToRefresh onRefresh={handleRefresh} className="flex-1">
        <main className="max-w-3xl mx-auto px-4 py-8 space-y-8 w-full">
          {/* Search Section */}
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                Track Your Delivery
              </h1>
              <p className="text-muted-foreground">
                Enter your tracking ID to see the latest status of your shipment.
              </p>
            </div>

            <div className="max-w-lg mx-auto">
              <div className="flex gap-2 p-2 rounded-xl bg-card border border-border shadow-sm">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="e.g., 123T45S67CP"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 font-mono"
                  />
                </div>
                <Button onClick={handleSearch} disabled={isLoading} className="bg-primary text-primary-foreground px-6">
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-1" />
                      Track
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-6 text-center space-y-2">
                <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
                <p className="font-medium text-foreground">Tracking Not Found</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {isLoading && !tracking && (
            <Card className="border-border">
              <CardContent className="p-12 text-center space-y-4">
                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-muted-foreground">Looking up your shipment...</p>
              </CardContent>
            </Card>
          )}

          {/* Tracking Results */}
          {tracking && !isLoading && (
            <div className="space-y-6">
              {/* Status Hero Card */}
              <Card className={`overflow-hidden border-2 ${
                isDelivered ? 'border-primary/30 bg-primary/5' :
                isIncomplete ? 'border-destructive/30 bg-destructive/5' :
                'border-secondary/30 bg-secondary/5'
              }`}>
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 ${
                      isDelivered ? 'bg-primary text-primary-foreground' :
                      isIncomplete ? 'bg-destructive text-destructive-foreground' :
                      'bg-secondary text-secondary-foreground'
                    }`}>
                      {isDelivered ? <CheckCircle className="w-10 h-10" /> :
                       isIncomplete ? <AlertCircle className="w-10 h-10" /> :
                       <Truck className="w-10 h-10" />}
                    </div>
                    <div className="text-center sm:text-left flex-1 space-y-1">
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Current Status
                      </p>
                      <h2 className="text-2xl font-bold text-foreground">
                        {isDelivered ? 'Successfully Delivered' :
                         isIncomplete ? 'Delivery Incomplete' :
                         currentStatusIndex === 2 ? 'On The Way' :
                         currentStatusIndex === 1 ? 'Picked Up' : 'Order Received'}
                      </h2>
                      {tracking.delivery_status && (
                        <p className="text-sm text-muted-foreground">
                          {tracking.delivery_status.replace(/_/g, ' ')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Shipment Details */}
              <div className="grid sm:grid-cols-3 gap-4">
                <Card className="border-border">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Shipment ID</p>
                    <p className="font-mono font-semibold text-foreground text-sm">
                      {tracking.shipment_id || '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Destination</p>
                    <p className="font-semibold text-foreground text-sm">
                      {tracking.warehouse_city || tracking.country || '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Recipient</p>
                    <p className="font-semibold text-foreground text-sm">
                      {tracking.client_initials || '—'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Timeline */}
              <Card className="border-border">
                <CardContent className="p-6 sm:p-8">
                  <h3 className="text-lg font-semibold text-foreground mb-6">Delivery Progress</h3>
                  
                  {/* Progress Bar */}
                  <div className="mb-8">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          isIncomplete ? 'bg-destructive' : 'bg-primary'
                        }`}
                        style={{ width: `${Math.max(((currentStatusIndex + 1) / timelineSteps.length) * 100, 5)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2">
                      {timelineSteps.map((step, index) => (
                        <div key={step.status} className="flex flex-col items-center" style={{ width: `${100 / timelineSteps.length}%` }}>
                          <div className={`w-3 h-3 rounded-full -mt-[0.9rem] border-2 border-card ${
                            index <= currentStatusIndex
                              ? isIncomplete && index === timelineSteps.length - 1
                                ? 'bg-destructive'
                                : 'bg-primary'
                              : 'bg-muted'
                          }`} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Timeline Steps */}
                  <div className="space-y-6">
                    {timelineSteps.map((step, index) => {
                      const isCompleted = index <= currentStatusIndex;
                      const isCurrent = index === currentStatusIndex;
                      const Icon = step.icon;
                      const timestamp = getTimestamp(step.status);
                      const isFinalStep = step.status === 'COMPLETED';
                      const showAsIncomplete = isFinalStep && isIncomplete;

                      return (
                        <div key={step.status} className={`flex gap-4 ${!isCompleted ? 'opacity-40' : ''}`}>
                          <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
                            showAsIncomplete
                              ? 'bg-destructive text-destructive-foreground'
                              : isCompleted
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                          } ${isCurrent && !showAsIncomplete ? 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background' : ''}`}>
                            {showAsIncomplete ? <AlertCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className={`font-semibold ${
                                showAsIncomplete ? 'text-destructive' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                              }`}>
                                {showAsIncomplete ? 'Delivery Incomplete' : step.label}
                              </p>
                              {timestamp && (
                                <p className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatTimestamp(timestamp)}
                                </p>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {showAsIncomplete ? 'The delivery could not be completed. Please contact your pharmacy.' : step.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Live Updates Indicator */}
              {lastUpdated && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span>Live updates active</span>
                  <span className="text-muted-foreground/50">•</span>
                  <span>Last updated {lastUpdated.toLocaleTimeString('en-CA', { timeZone: 'America/Toronto' })}</span>
                </div>
              )}

              {/* Privacy Note */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pb-4">
                <Shield className="w-3.5 h-3.5" />
                <span>Your personal information is protected and never shared publicly.</span>
              </div>
            </div>
          )}

          {/* Empty State when no tracking searched */}
          {!tracking && !isLoading && !error && !trackingId && (
            <div className="text-center py-12 space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Package className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Enter Your Tracking ID</h2>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Your tracking ID was provided by your pharmacy when your prescription was dispatched for delivery.
                </p>
              </div>
              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>Secure</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>Real-Time</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>Reliable</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </PullToRefresh>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-6">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={endoverdoseLogo} alt="TSCP" className="h-5 w-5 rounded" />
            <span>TSCP Dispatch</span>
          </div>
          <span>© {new Date().getFullYear()} All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
