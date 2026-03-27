import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams, Link } from 'react-router-dom';
import { Search, ArrowLeft, Shield, Clock, Package, Send, CheckCircle2, XCircle, Timer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { PublicTracking } from '@/types/auth';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import medxpressLogo from '@/assets/logo-dark.png';

const timelineSteps = [
  { status: 'PENDING', label: 'Pending', pendingText: 'Awaiting processing', icon: Timer },
  { status: 'PICKED_UP_AND_ASSIGNED', label: 'Picked Up', pendingText: 'Not yet assigned', icon: Package },
  { status: 'IN_ROUTE', label: 'Shipped', pendingText: 'Driver not started', icon: Send },
  { status: 'COMPLETED', label: 'Delivered', pendingText: 'Awaiting delivery', icon: CheckCircle2 },
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
        setError('No shipment found with that tracking ID.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
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
      month: 'short', day: 'numeric',
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

  const buildLocation = () => {
    if (!tracking) return '—';
    const parts = [tracking.geo_zone, tracking.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '—';
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <img src={medxpressLogo} alt="KitKin Express" className="h-10 w-auto object-contain" />
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground text-xs gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Home
            </Button>
          </Link>
        </div>
      </header>

      <PullToRefresh onRefresh={handleRefresh} className="flex-1">
        <main className="max-w-2xl mx-auto px-4 py-6 sm:py-8 w-full space-y-6">
          {/* Search */}
          <div className="space-y-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                Track Your Delivery
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your tracking ID to view shipment status.
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter tracking ID"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9 font-mono text-sm h-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={isLoading} size="default" className="px-5 h-10">
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : 'Track'}
              </Button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <XCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-foreground">{error}</p>
            </div>
          )}

          {/* Loading */}
          {isLoading && !tracking && (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Looking up shipment…</p>
            </div>
          )}

          {/* Results */}
          {tracking && !isLoading && (
            <div className="space-y-6">
              {/* Summary row */}
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Status</p>
                    <p className={`text-lg font-semibold mt-0.5 ${
                      isDelivered ? 'text-primary' :
                      isIncomplete ? 'text-destructive' :
                      'text-foreground'
                    }`}>
                      {isDelivered ? 'Delivered' :
                       isIncomplete ? 'Incomplete' :
                       currentStatusIndex === 2 ? 'In Transit' :
                       currentStatusIndex === 1 ? 'Picked Up' : 'Processing'}
                    </p>
                  </div>
                  {lastUpdated && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                      Live
                    </div>
                  )}
                </div>

                <Separator className="mb-4" />

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Tracking ID</p>
                    <p className="font-mono font-medium text-foreground text-xs">{tracking.tracking_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Recipient</p>
                    <p className="font-medium text-foreground">{tracking.client_initials || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Destination</p>
                    <p className="font-medium text-foreground text-xs">{buildLocation()}</p>
                  </div>
                </div>
              </div>

              {/* Delivery Timeline — vertical stepper */}
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Delivery Timeline</h3>
                </div>

                <div className="relative">
                  {timelineSteps.map((step, index) => {
                    const isCompleted = index <= currentStatusIndex;
                    const isCurrent = index === currentStatusIndex;
                    const isFinalStep = step.status === 'COMPLETED';
                    const showAsIncomplete = isFinalStep && isIncomplete;
                    const timestamp = getTimestamp(step.status);
                    const isLast = index === timelineSteps.length - 1;
                    const Icon = step.icon;

                    // Connector line color
                    const nextCompleted = (index + 1) <= currentStatusIndex;

                    return (
                      <div key={step.status} className="flex gap-4 relative">
                        {/* Vertical line + dot */}
                        <div className="flex flex-col items-center">
                          {/* Dot */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                            showAsIncomplete
                              ? 'border-destructive bg-destructive/10 text-destructive'
                              : isCompleted
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-muted text-muted-foreground'
                          }`}>
                            {showAsIncomplete ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <Icon className="w-4 h-4" />
                            )}
                          </div>
                          {/* Connector */}
                          {!isLast && (
                            <div className={`w-0.5 flex-1 min-h-[2rem] transition-colors ${
                              nextCompleted
                                ? isIncomplete ? 'bg-destructive/30' : 'bg-primary/30'
                                : 'bg-border'
                            }`} />
                          )}
                        </div>

                        {/* Content */}
                        <div className={`pb-6 ${isLast ? 'pb-0' : ''}`}>
                          <p className={`text-sm font-medium leading-8 ${
                            showAsIncomplete ? 'text-destructive' :
                            isCompleted ? 'text-foreground' :
                            'text-muted-foreground'
                          }`}>
                            {showAsIncomplete ? 'Delivery Incomplete' : step.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isCompleted && timestamp
                              ? formatTimestamp(timestamp)
                              : showAsIncomplete
                                ? 'Contact your pharmacy for assistance'
                                : step.pendingText}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer info */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-2">
                <Shield className="w-3 h-3" />
                <span>Personal information is protected and never shared publicly.</span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!tracking && !isLoading && !error && !trackingId && (
            <div className="text-center py-16 space-y-4">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Package className="w-7 h-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Enter Your Tracking ID</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                  Your tracking ID was provided by your pharmacy when your order was dispatched.
                </p>
              </div>
            </div>
          )}
        </main>
      </PullToRefresh>

      {/* Footer */}
      <footer className="border-t border-border py-4">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={medxpressLogo} alt="KitKin Express" className="h-5 w-auto object-contain" />
          </div>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
