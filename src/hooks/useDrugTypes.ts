import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DrugType, DrugFieldSchema, DEFAULT_DRUG_FIELDS } from '@/types/import';
import { toast } from 'sonner';

export function useDrugTypes() {
  const [drugTypes, setDrugTypes] = useState<DrugType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDrugTypes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('drug_types')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      // Parse field_schema from JSONB
      const parsed = (data || []).map(dt => ({
        ...dt,
        field_schema: (dt.field_schema as unknown as DrugFieldSchema[]) || [],
      })) as DrugType[];
      
      setDrugTypes(parsed);
    } catch (error) {
      console.error('Error fetching drug types:', error);
      toast.error('Failed to load drug types');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrugTypes();
  }, [fetchDrugTypes]);

  const createDrugType = async (data: {
    display_name: string;
    drug_type_key?: string;
    description?: string;
    field_schema?: DrugFieldSchema[];
  }) => {
    try {
      const key = data.drug_type_key || data.display_name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const fields = data.field_schema || DEFAULT_DRUG_FIELDS;
      
      const maxSort = Math.max(...drugTypes.map(d => d.sort_order), 0);
      
      const { error } = await supabase
        .from('drug_types')
        .insert({
          display_name: data.display_name,
          drug_type_key: key,
          description: data.description || null,
          field_schema: fields as any,
          sort_order: maxSort + 1,
        });

      if (error) throw error;
      
      toast.success('Drug type created');
      await fetchDrugTypes();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating drug type:', error);
      toast.error(error.message || 'Failed to create drug type');
      return { success: false, error: error.message };
    }
  };

  const updateDrugType = async (id: string, data: Partial<DrugType>) => {
    try {
      const updateData: any = { ...data };
      if (data.field_schema) {
        updateData.field_schema = data.field_schema as any;
      }
      
      const { error } = await supabase
        .from('drug_types')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Drug type updated');
      await fetchDrugTypes();
      return { success: true };
    } catch (error: any) {
      console.error('Error updating drug type:', error);
      toast.error(error.message || 'Failed to update drug type');
      return { success: false, error: error.message };
    }
  };

  const deleteDrugType = async (id: string) => {
    try {
      const { error } = await supabase
        .from('drug_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Drug type deleted');
      await fetchDrugTypes();
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting drug type:', error);
      toast.error(error.message || 'Failed to delete drug type');
      return { success: false, error: error.message };
    }
  };

  return {
    drugTypes,
    activeDrugTypes: drugTypes.filter(dt => dt.is_active),
    isLoading,
    createDrugType,
    updateDrugType,
    deleteDrugType,
    refreshDrugTypes: fetchDrugTypes,
  };
}
