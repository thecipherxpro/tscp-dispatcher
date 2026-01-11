import { useState } from 'react';
import { Plus, FileSpreadsheet, Pill, Loader2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDrugTypes } from '@/hooks/useDrugTypes';
import { useImportTemplates } from '@/hooks/useImportTemplates';
import { DrugTypeCard } from '@/components/admin/import/DrugTypeCard';
import { DrugTypeSheet } from '@/components/admin/import/DrugTypeSheet';
import { TemplateCard } from '@/components/admin/import/TemplateCard';
import { TemplateBuilderSheet } from '@/components/admin/import/TemplateBuilderSheet';
import { DrugType, ImportTemplate } from '@/types/import';
import { useIsMobile } from '@/hooks/use-mobile';

export default function ImportTemplates() {
  const isMobile = useIsMobile();
  const { 
    drugTypes, 
    isLoading: isDrugTypesLoading, 
    createDrugType, 
    updateDrugType, 
    deleteDrugType 
  } = useDrugTypes();
  
  const { 
    templates, 
    isLoading: isTemplatesLoading, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate,
    setDefaultTemplate 
  } = useImportTemplates();

  const [activeTab, setActiveTab] = useState('templates');
  
  // Drug Type state
  const [showDrugTypeSheet, setShowDrugTypeSheet] = useState(false);
  const [selectedDrugType, setSelectedDrugType] = useState<DrugType | null>(null);
  const [drugTypeToDelete, setDrugTypeToDelete] = useState<DrugType | null>(null);
  
  // Template state
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ImportTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<ImportTemplate | null>(null);

  const handleEditDrugType = (drugType: DrugType) => {
    setSelectedDrugType(drugType);
    setShowDrugTypeSheet(true);
  };

  const handleDeleteDrugType = (drugType: DrugType) => {
    setDrugTypeToDelete(drugType);
  };

  const confirmDeleteDrugType = async () => {
    if (drugTypeToDelete) {
      await deleteDrugType(drugTypeToDelete.id);
      setDrugTypeToDelete(null);
    }
  };

  const handleToggleDrugTypeActive = async (drugType: DrugType, isActive: boolean) => {
    await updateDrugType(drugType.id, { is_active: isActive });
  };

  const handleSaveDrugType = async (data: any) => {
    if (selectedDrugType) {
      return await updateDrugType(selectedDrugType.id, data);
    } else {
      return await createDrugType(data);
    }
  };

  const handleEditTemplate = (template: ImportTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateBuilder(true);
  };

  const handleDeleteTemplate = (template: ImportTemplate) => {
    setTemplateToDelete(template);
  };

  const confirmDeleteTemplate = async () => {
    if (templateToDelete) {
      await deleteTemplate(templateToDelete.id);
      setTemplateToDelete(null);
    }
  };

  const handleSetDefaultTemplate = async (template: ImportTemplate) => {
    await setDefaultTemplate(template.id);
  };

  const handleSaveTemplate = async (data: any) => {
    if (selectedTemplate) {
      return await updateTemplate(selectedTemplate.id, data);
    } else {
      return await createTemplate(data);
    }
  };

  return (
    <AdminLayout title="Import Templates" showBackButton={isMobile}>
      <div className={isMobile ? "p-4 space-y-4 pb-24" : "p-6 lg:p-8 space-y-6"}>
        {!isMobile && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">Import Templates</h2>
            <p className="text-muted-foreground">Configure column mappings and drug types for CSV imports</p>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="templates" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="drug-types" className="gap-2">
              <Pill className="w-4 h-4" />
              Drug Types
            </TabsTrigger>
          </TabsList>
          
          {/* Templates Tab */}
          <TabsContent value="templates" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Import Templates</h2>
                <p className="text-sm text-muted-foreground">
                  Configure column mappings for CSV/Excel imports
                </p>
              </div>
              <Button 
                size="sm"
                onClick={() => {
                  setSelectedTemplate(null);
                  setShowTemplateBuilder(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>
            
            {isTemplatesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-foreground font-medium">No templates yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a template to configure column mappings
                  </p>
                  <Button 
                    className="mt-4"
                    onClick={() => {
                      setSelectedTemplate(null);
                      setShowTemplateBuilder(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className={isMobile ? "space-y-3" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}>
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={handleEditTemplate}
                    onDelete={handleDeleteTemplate}
                    onSetDefault={handleSetDefaultTemplate}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Drug Types Tab */}
          <TabsContent value="drug-types" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Drug Types</h2>
                <p className="text-sm text-muted-foreground">
                  Configure medication types and their fields
                </p>
              </div>
              <Button 
                size="sm"
                onClick={() => {
                  setSelectedDrugType(null);
                  setShowDrugTypeSheet(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>
            
            {isDrugTypesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : drugTypes.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <Pill className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-foreground font-medium">No drug types yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add drug types to enable medication field mapping
                  </p>
                  <Button 
                    className="mt-4"
                    onClick={() => {
                      setSelectedDrugType(null);
                      setShowDrugTypeSheet(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Drug Type
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className={isMobile ? "space-y-3" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}>
                {drugTypes.map((drugType) => (
                  <DrugTypeCard
                    key={drugType.id}
                    drugType={drugType}
                    onEdit={handleEditDrugType}
                    onDelete={handleDeleteDrugType}
                    onToggleActive={handleToggleDrugTypeActive}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Drug Type Sheet */}
      <DrugTypeSheet
        isOpen={showDrugTypeSheet}
        onClose={() => {
          setShowDrugTypeSheet(false);
          setSelectedDrugType(null);
        }}
        drugType={selectedDrugType}
        onSave={handleSaveDrugType}
      />

      {/* Template Builder Sheet */}
      <TemplateBuilderSheet
        isOpen={showTemplateBuilder}
        onClose={() => {
          setShowTemplateBuilder(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
        drugTypes={drugTypes}
        onSave={handleSaveTemplate}
      />

      {/* Delete Drug Type Confirmation */}
      <AlertDialog open={!!drugTypeToDelete} onOpenChange={() => setDrugTypeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Drug Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{drugTypeToDelete?.display_name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDrugType} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Template Confirmation */}
      <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.template_name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTemplate} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
