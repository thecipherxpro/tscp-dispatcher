import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ImportTemplate, ColumnMapping } from '@/types/import';
import { toast } from 'sonner';

export function useImportTemplates() {
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('import_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const parsed = (data || []).map(t => ({
        ...t,
        column_mappings: (t.column_mappings as unknown as ColumnMapping[]) || [],
        drug_type_mappings: (t.drug_type_mappings as unknown as any[]) || [],
      })) as ImportTemplate[];
      
      setTemplates(parsed);
    } catch (error) {
      console.error('Error fetching import templates:', error);
      toast.error('Failed to load import templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (data: {
    template_name: string;
    description?: string;
    column_mappings: ColumnMapping[];
    drug_type_mappings?: any[];
    is_default?: boolean;
  }) => {
    try {
      // If setting as default, unset any existing default
      if (data.is_default) {
        await supabase
          .from('import_templates')
          .update({ is_default: false })
          .eq('is_default', true);
      }

      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('import_templates')
        .insert({
          template_name: data.template_name,
          description: data.description || null,
          column_mappings: data.column_mappings as any,
          drug_type_mappings: (data.drug_type_mappings || []) as any,
          is_default: data.is_default || false,
          created_by: user?.user?.id || null,
        });

      if (error) throw error;
      
      toast.success('Template created');
      await fetchTemplates();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating template:', error);
      toast.error(error.message || 'Failed to create template');
      return { success: false, error: error.message };
    }
  };

  const updateTemplate = async (id: string, data: Partial<ImportTemplate>) => {
    try {
      // If setting as default, unset any existing default
      if (data.is_default) {
        await supabase
          .from('import_templates')
          .update({ is_default: false })
          .eq('is_default', true);
      }

      const updateData: any = { ...data };
      if (data.column_mappings) {
        updateData.column_mappings = data.column_mappings as any;
      }
      if (data.drug_type_mappings) {
        updateData.drug_type_mappings = data.drug_type_mappings as any;
      }
      
      const { error } = await supabase
        .from('import_templates')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Template updated');
      await fetchTemplates();
      return { success: true };
    } catch (error: any) {
      console.error('Error updating template:', error);
      toast.error(error.message || 'Failed to update template');
      return { success: false, error: error.message };
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('import_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Template deleted');
      await fetchTemplates();
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error(error.message || 'Failed to delete template');
      return { success: false, error: error.message };
    }
  };

  const setDefaultTemplate = async (id: string) => {
    try {
      // Unset all defaults first
      await supabase
        .from('import_templates')
        .update({ is_default: false })
        .eq('is_default', true);
      
      // Set the new default
      const { error } = await supabase
        .from('import_templates')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Default template updated');
      await fetchTemplates();
      return { success: true };
    } catch (error: any) {
      console.error('Error setting default template:', error);
      toast.error(error.message || 'Failed to set default template');
      return { success: false, error: error.message };
    }
  };

  const getDefaultTemplate = () => {
    return templates.find(t => t.is_default) || null;
  };

  return {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
    getDefaultTemplate,
    refreshTemplates: fetchTemplates,
  };
}
