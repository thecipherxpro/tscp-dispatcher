import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addDays, startOfDay, isAfter, isBefore, differenceInDays } from 'date-fns';

// Pay calculation constants
export const BASE_RATE = 4.00;
export const PER_KM_RATE = 0.50;
export const PAYOUT_INTERVAL_DAYS = 14;

export interface DriverEarning {
  id: string;
  driver_id: string;
  order_id: string;
  shipment_id: string | null;
  distance_km: number;
  base_rate: number;
  per_km_rate: number;
  distance_earnings: number;
  total_earnings: number;
  completed_at: string;
  payout_period_start: string | null;
  payout_period_end: string | null;
  payout_status: string;
  created_at: string;
}

export interface PayoutPeriod {
  start: Date;
  end: Date;
  nextPayoutDate: Date;
  daysRemaining: number;
  isActive: boolean;
}

export interface EarningsSummary {
  totalEarnings: number;
  totalOrders: number;
  totalDistanceKm: number;
  weeklyEarnings: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
}

export function calculateEarnings(distanceKm: number): {
  baseRate: number;
  perKmRate: number;
  distanceEarnings: number;
  totalEarnings: number;
} {
  const distanceEarnings = distanceKm * PER_KM_RATE;
  const totalEarnings = BASE_RATE + distanceEarnings;
  
  return {
    baseRate: BASE_RATE,
    perKmRate: PER_KM_RATE,
    distanceEarnings: Math.round(distanceEarnings * 100) / 100,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
  };
}

export function getPayoutPeriod(firstOrderDate: Date | null): PayoutPeriod | null {
  if (!firstOrderDate) return null;
  
  const now = new Date();
  const startDate = startOfDay(firstOrderDate);
  
  // Calculate how many periods have passed
  const daysSinceStart = differenceInDays(now, startDate);
  const periodsElapsed = Math.floor(daysSinceStart / PAYOUT_INTERVAL_DAYS);
  
  const periodStart = addDays(startDate, periodsElapsed * PAYOUT_INTERVAL_DAYS);
  const periodEnd = addDays(periodStart, PAYOUT_INTERVAL_DAYS - 1);
  const nextPayoutDate = addDays(periodStart, PAYOUT_INTERVAL_DAYS);
  
  const daysRemaining = differenceInDays(nextPayoutDate, now);
  
  return {
    start: periodStart,
    end: periodEnd,
    nextPayoutDate,
    daysRemaining: Math.max(0, daysRemaining),
    isActive: isAfter(now, startDate) && isBefore(now, addDays(periodEnd, 1)),
  };
}

export function useDriverEarnings() {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<DriverEarning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<EarningsSummary>({
    totalEarnings: 0,
    totalOrders: 0,
    totalDistanceKm: 0,
    weeklyEarnings: 0,
    pendingOrders: 0,
    inProgressOrders: 0,
    completedOrders: 0,
  });

  const fetchEarnings = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch earnings
      const { data: earningsData, error: earningsError } = await supabase
        .from('driver_earnings')
        .select('*')
        .eq('driver_id', user.id)
        .order('completed_at', { ascending: false });
      
      if (earningsError) throw earningsError;
      
      setEarnings((earningsData || []) as DriverEarning[]);
      
      // Fetch order stats
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('timeline_status')
        .eq('assigned_driver_id', user.id);
      
      if (ordersError) throw ordersError;
      
      const orders = ordersData || [];
      const completedOrders = orders.filter(o => 
        o.timeline_status === 'COMPLETED_DELIVERED' || 
        o.timeline_status === 'COMPLETED_INCOMPLETE'
      ).length;
      const pendingOrders = orders.filter(o => 
        o.timeline_status === 'PENDING' || 
        o.timeline_status === 'PICKED_UP_AND_ASSIGNED' ||
        o.timeline_status === 'CONFIRMED'
      ).length;
      const inProgressOrders = orders.filter(o => 
        o.timeline_status === 'IN_ROUTE'
      ).length;
      
      // Calculate totals from earnings
      const totalEarnings = (earningsData || []).reduce((sum, e: any) => sum + (e.total_earnings || 0), 0);
      const totalDistanceKm = (earningsData || []).reduce((sum, e: any) => sum + (e.distance_km || 0), 0);
      
      // Calculate weekly earnings (last 7 days)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weeklyEarnings = (earningsData || [])
        .filter((e: any) => new Date(e.completed_at) >= oneWeekAgo)
        .reduce((sum, e: any) => sum + (e.total_earnings || 0), 0);
      
      setSummary({
        totalEarnings,
        totalOrders: (earningsData || []).length,
        totalDistanceKm,
        weeklyEarnings,
        pendingOrders,
        inProgressOrders,
        completedOrders,
      });
      
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  return {
    earnings,
    summary,
    isLoading,
    refetch: fetchEarnings,
  };
}

export function usePayoutSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('driver_payout_settings')
        .select('*')
        .eq('driver_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching payout settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const saveSettings = async (newSettings: any) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    try {
      const payload = {
        driver_id: user.id,
        ...newSettings,
        updated_at: new Date().toISOString(),
      };
      
      if (settings) {
        // Update
        const { error } = await supabase
          .from('driver_payout_settings')
          .update(payload)
          .eq('driver_id', user.id);
        
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('driver_payout_settings')
          .insert(payload);
        
        if (error) throw error;
      }
      
      await fetchSettings();
      return { success: true };
    } catch (error: any) {
      console.error('Error saving payout settings:', error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    isLoading,
    saveSettings,
    refetch: fetchSettings,
  };
}

export function usePayStubs() {
  const { user } = useAuth();
  const [stubs, setStubs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStubs = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('driver_pay_stubs')
        .select('*')
        .eq('driver_id', user.id)
        .order('period_end', { ascending: false });
      
      if (error) throw error;
      setStubs(data || []);
    } catch (error) {
      console.error('Error fetching pay stubs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const generateStub = async (periodStart: Date, periodEnd: Date) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    try {
      // Fetch earnings for the period
      const { data: earnings, error: earningsError } = await supabase
        .from('driver_earnings')
        .select('*')
        .eq('driver_id', user.id)
        .gte('completed_at', periodStart.toISOString())
        .lte('completed_at', periodEnd.toISOString());
      
      if (earningsError) throw earningsError;
      
      const totalOrders = (earnings || []).length;
      const totalDistanceKm = (earnings || []).reduce((sum, e: any) => sum + (e.distance_km || 0), 0);
      const totalEarnings = (earnings || []).reduce((sum, e: any) => sum + (e.total_earnings || 0), 0);
      
      const stubData = {
        earnings: earnings || [],
        generatedAt: new Date().toISOString(),
      };
      
      const { error } = await supabase
        .from('driver_pay_stubs')
        .insert({
          driver_id: user.id,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          total_orders: totalOrders,
          total_distance_km: totalDistanceKm,
          total_earnings: totalEarnings,
          is_auto_generated: false,
          stub_data: stubData,
        });
      
      if (error) throw error;
      
      await fetchStubs();
      return { success: true };
    } catch (error: any) {
      console.error('Error generating pay stub:', error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchStubs();
  }, [fetchStubs]);

  return {
    stubs,
    isLoading,
    generateStub,
    refetch: fetchStubs,
  };
}
