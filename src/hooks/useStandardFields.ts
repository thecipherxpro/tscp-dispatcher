import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StandardField {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useStandardFields() {
  const [standardFields, setStandardFields] = useState<StandardField[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStandardFields = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('standard_fields')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setStandardFields(data || []);
    } catch (error) {
      console.error('Error fetching standard fields:', error);
      toast.error('Failed to load standard fields');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStandardFields();
  }, [fetchStandardFields]);

  const createStandardField = async (data: {
    field_key: string;
    field_label: string;
    field_type?: string;
    is_required?: boolean;
  }) => {
    try {
      // Get the highest sort_order
      const maxSortOrder = standardFields.reduce((max, f) => Math.max(max, f.sort_order), 0);
      
      const { error } = await supabase
        .from('standard_fields')
        .insert({
          field_key: data.field_key,
          field_label: data.field_label,
          field_type: data.field_type || 'text',
          is_required: data.is_required || false,
          sort_order: maxSortOrder + 1,
        });

      if (error) throw error;
      
      toast.success('Standard field created');
      await fetchStandardFields();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating standard field:', error);
      toast.error(error.message || 'Failed to create standard field');
      return { success: false };
    }
  };

  const updateStandardField = async (id: string, data: Partial<StandardField>) => {
    try {
      const { error } = await supabase
        .from('standard_fields')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Standard field updated');
      await fetchStandardFields();
      return { success: true };
    } catch (error: any) {
      console.error('Error updating standard field:', error);
      toast.error(error.message || 'Failed to update standard field');
      return { success: false };
    }
  };

  const deleteStandardField = async (id: string) => {
    try {
      const { error } = await supabase
        .from('standard_fields')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Standard field deleted');
      await fetchStandardFields();
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting standard field:', error);
      toast.error(error.message || 'Failed to delete standard field');
      return { success: false };
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    return updateStandardField(id, { is_active: isActive });
  };

  return {
    standardFields,
    isLoading,
    createStandardField,
    updateStandardField,
    deleteStandardField,
    toggleActive,
    refetch: fetchStandardFields,
  };
}
