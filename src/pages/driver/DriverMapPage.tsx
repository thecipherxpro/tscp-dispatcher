import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DriverMapView } from '@/components/driver/DriverMapView';
import { Order } from '@/types/auth';
import { DriverStatusUpdateModal } from '@/components/orders/DriverStatusUpdateModal';

export default function DriverMapPage() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  return (
    <AppLayout title="Delivery Map" showBackButton>
      <div className="h-[calc(100vh-8rem)]">
        <DriverMapView onOrderSelect={setSelectedOrder} />
      </div>

      <DriverStatusUpdateModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onSuccess={() => setSelectedOrder(null)}
      />
    </AppLayout>
  );
}
