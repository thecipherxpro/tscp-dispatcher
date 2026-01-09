import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Truck, CheckCircle, DollarSign, Loader2, Wallet } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useDriverEarnings, DriverEarning } from "@/hooks/useDriverEarnings";
import { StatCard } from "@/components/wallet/StatCard";
import { EarningsOrderCard } from "@/components/wallet/EarningsOrderCard";
import { OrderEarningsSheet } from "@/components/wallet/OrderEarningsSheet";
import { PayoutSettingsSheet } from "@/components/wallet/PayoutSettingsSheet";
import { EarningsSheet } from "@/components/wallet/EarningsSheet";

export default function DriverWallet() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { earnings, summary, isLoading } = useDriverEarnings();

  const [selectedEarning, setSelectedEarning] = useState<DriverEarning | null>(null);
  const [showOrderSheet, setShowOrderSheet] = useState(false);
  const [showPayoutSettings, setShowPayoutSettings] = useState(false);
  const [showEarnings, setShowEarnings] = useState(false);

  const handleOrderClick = (earning: DriverEarning) => {
    setSelectedEarning(earning);
    setShowOrderSheet(true);
  };

  const getInitials = (name: string | null) => {
    if (!name) return "D";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3 safe-area-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-primary-foreground" />
            </button>
            <h1 className="text-xl font-bold text-foreground">WALLET</h1>
          </div>
          <Avatar className="w-10 h-10">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-muted">{getInitials(profile?.full_name || null)}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="p-4 space-y-6">
          {/* Stats Bento Grid */}
          <div className="grid grid-cols-2 gap-3">
            {isLoading ? (
              <>
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
              </>
            ) : (
              <>
                <StatCard
                  title="Pending Orders"
                  value={summary.pendingOrders}
                  subtitle="Awaiting Delivery"
                  variant="warning"
                />
                <StatCard
                  title="In Progress"
                  value={summary.inProgressOrders}
                  subtitle="Started Jobs"
                  variant="primary"
                />
                <StatCard
                  title="Completed"
                  value={summary.completedOrders}
                  subtitle="Delivered Jobs"
                  variant="success"
                />
                <StatCard
                  title="Weekly Earnings"
                  value={`$${summary.weeklyEarnings.toFixed(2)}`}
                  subtitle="Last 7 days"
                  variant="primary"
                />
              </>
            )}
          </div>

          {/* Completed Orders Section */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Completed Orders</h2>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : earnings.length === 0 ? (
              <div className="bg-muted/30 rounded-xl p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <Wallet className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">No completed orders yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your completed deliveries and earnings will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {earnings.map((earning) => (
                  <EarningsOrderCard key={earning.id} earning={earning} onClick={() => handleOrderClick(earning)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-area-bottom z-40">
        <div className="grid grid-cols-2 divide-x divide-border">
          <Button
            variant="ghost"
            className="h-16 rounded-none text-sm font-semibold flex flex-col items-center justify-center gap-1"
            onClick={() => setShowPayoutSettings(true)}
          >
            <DollarSign className="w-5 h-5" />
            Payout Setting
          </Button>
          <Button
            variant="ghost"
            className="h-16 rounded-none text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground flex flex-col items-center justify-center gap-1"
            onClick={() => setShowEarnings(true)}
          >
            <CheckCircle className="w-5 h-5" />
            Earnings
          </Button>
        </div>
      </div>

      {/* Sheets */}
      <OrderEarningsSheet earning={selectedEarning} open={showOrderSheet} onOpenChange={setShowOrderSheet} />

      <PayoutSettingsSheet open={showPayoutSettings} onOpenChange={setShowPayoutSettings} />

      <EarningsSheet open={showEarnings} onOpenChange={setShowEarnings} />
    </div>
  );
}
