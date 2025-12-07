import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, Truck, MapPin, CheckCircle, Clock, AlertCircle, Search, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { PublicTracking } from '@/types/auth';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

const timelineSteps = [
  { status: 'PENDING', label: 'Pending', icon: Clock },
  { status: 'CONFIRMED', label: 'Confirmed', icon: Package },
  { status: 'IN_ROUTE', label: 'In Route', icon: Truck },
  { status: 'ARRIVED', label: 'Arrived', icon: MapPin },
  { status: 'COMPLETED', label: 'Completed', icon: CheckCircle },
];

export default function TrackShipment() {
  const [searchParams] = useSearchParams();
  const trackingId = searchParams.get('tracking');
  
  const [tracking, setTracking] = useState<PublicTracking | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(trackingId || '');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const haptic = useHapticFeedback();

  const fetchTracking = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('public_tracking')
        .select('*')
        .eq('tracking_id', id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTracking(data as PublicTracking);
        setLastUpdated(new Date());
        
        if (data.driver_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', data.driver_id)
            .maybeSingle();
          
          if (profile) {
            setDriverName(profile.full_name);
          }
        }
      } else {
        setError('Tracking not found. Please check your tracking ID.');
      }
    } catch (err) {
      setError('An error occurred while fetching tracking information.');
      console.error('Tracking error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (trackingId) {
      fetchTracking(trackingId);
    }
  }, [trackingId, fetchTracking]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!trackingId) return;

    const channel = supabase
      .channel(`tracking-${trackingId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'public_tracking',
          filter: `tracking_id=eq.${trackingId}`
        },
        (payload) => {
          setTracking(payload.new as PublicTracking);
          setLastUpdated(new Date());
          haptic.success();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trackingId, haptic]);

  const handleRefresh = async () => {
    if (tracking?.tracking_id) {
      await fetchTracking(tracking.tracking_id);
    }
  };

  const handleSearch = () => {
    if (searchInput.trim()) {
      fetchTracking(searchInput.trim());
    }
  };

  const getStatusIndex = (status: string) => {
    return timelineSteps.findIndex(s => s.status === status);
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleString('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const currentStatusIndex = tracking ? getStatusIndex(tracking.timeline_status) : -1;

  return (
    <div className="min-h-screen bg-background safe-area-inset flex flex-col">
      <header className="bg-primary text-primary-foreground py-6 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="w-6 h-6" />
            <h1 className="text-xl font-bold">TSCP Dispatch</h1>
          </div>
          <p className="text-primary-foreground/70 text-sm">Track Your Shipment</p>
        </div>
      </header>

      <PullToRefresh onRefresh={handleRefresh} className="flex-1">
        <main className="p-4 max-w-lg mx-auto space-y-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter tracking ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isLoading}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-muted-foreground mt-3">Loading tracking info...</p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="p-4 text-center">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {tracking && !isLoading && (
          <>
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground">Shipment ID</p>
                    <p className="font-mono font-medium text-foreground">
                      {tracking.shipment_id || 'Pending'}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {tracking.timeline_status.replace('_', ' ')}
                  </span>
                </div>
                
                {driverName && (
                  <div>
                    <p className="text-xs text-muted-foreground">Driver</p>
                    <p className="font-medium text-foreground">{driverName}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="font-medium text-foreground">
                    {tracking.city}, {tracking.province} {tracking.postal_code}
                  </p>
                </div>

                {tracking.client_initials && (
                  <div>
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="font-medium text-foreground">{tracking.client_initials}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground mb-4">Delivery Timeline</h3>
                <div className="space-y-4">
                  {timelineSteps.map((step, index) => {
                    const isCompleted = index <= currentStatusIndex;
                    const isCurrent = index === currentStatusIndex;
                    const Icon = step.icon;
                    
                    const timestamps: Record<string, string | null> = {
                      'PENDING': tracking.pending_at,
                      'CONFIRMED': tracking.confirmed_at,
                      'IN_ROUTE': tracking.in_route_at,
                      'ARRIVED': tracking.arrived_at,
                      'COMPLETED': tracking.completed_at,
                    };

                    return (
                      <div key={step.status} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          } ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          {index < timelineSteps.length - 1 && (
                            <div className={`w-0.5 h-8 ${isCompleted ? 'bg-primary' : 'bg-muted'}`} />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className={`font-medium ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {step.label}
                          </p>
                          {timestamps[step.status] && (
                            <p className="text-xs text-muted-foreground">
                              {formatTimestamp(timestamps[step.status])}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {tracking.delivery_status && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">Delivery Outcome</p>
                      <p className="text-sm text-green-700">
                        {tracking.delivery_status.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Live update indicator */}
            {lastUpdated && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Live updates enabled</span>
                <span>• Updated {lastUpdated.toLocaleTimeString('en-CA', { timeZone: 'America/Toronto' })}</span>
              </div>
            )}
          </>
        )}
        </main>
      </PullToRefresh>
    </div>
  );
}
