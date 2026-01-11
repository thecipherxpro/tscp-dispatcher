import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings as SettingsIcon, User, Tag, Save, ChevronRight } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

interface PackageLabelSettings {
  from_company: string;
  from_tagline: string;
  from_website: string;
  contact_address: string;
  contact_phone: string;
  contact_email: string;
}

const defaultLabelSettings: PackageLabelSettings = {
  from_company: "PharmaDocs+",
  from_tagline: "Healthcare Delivery Service",
  from_website: "www.endoverdose.ca",
  contact_address: "3426 Lake Shore Blvd W",
  contact_phone: "(844) 722-8829",
  contact_email: "info@tscp.ca",
};

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [labelSettings, setLabelSettings] = useState<PackageLabelSettings>(defaultLabelSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchLabelSettings();
  }, []);

  const fetchLabelSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "package_label")
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data?.setting_value) {
        setLabelSettings(data.setting_value as unknown as PackageLabelSettings);
      }
    } catch (error) {
      console.error("Error fetching label settings:", error);
      toast({
        title: "Error",
        description: "Failed to load label settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveLabelSettings = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("admin_settings")
        .update({ setting_value: JSON.parse(JSON.stringify(labelSettings)) })
        .eq("setting_key", "package_label");

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Package label settings have been updated",
      });
    } catch (error) {
      console.error("Error saving label settings:", error);
      toast({
        title: "Error",
        description: "Failed to save label settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof PackageLabelSettings, value: string) => {
    setLabelSettings((prev) => ({ ...prev, [field]: value }));
  };

  const SettingsContent = () => (
    <div className="space-y-6">
      {/* Quick Access to Profile */}
      <Card 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => navigate("/profile")}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">My Profile</p>
                <p className="text-sm text-muted-foreground">View and edit your profile</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Package Label Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Tag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Package Label Settings</CardTitle>
              <CardDescription>Configure the FROM and CONTACT information on package labels</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Tabs defaultValue="from" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="from">FROM Section</TabsTrigger>
                <TabsTrigger value="contact">CONTACT Section</TabsTrigger>
              </TabsList>

              <TabsContent value="from" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="from_company">Company Name</Label>
                  <Input
                    id="from_company"
                    value={labelSettings.from_company}
                    onChange={(e) => updateField("from_company", e.target.value)}
                    placeholder="PharmaDocs+"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from_tagline">Tagline</Label>
                  <Input
                    id="from_tagline"
                    value={labelSettings.from_tagline}
                    onChange={(e) => updateField("from_tagline", e.target.value)}
                    placeholder="Healthcare Delivery Service"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from_website">Website</Label>
                  <Input
                    id="from_website"
                    value={labelSettings.from_website}
                    onChange={(e) => updateField("from_website", e.target.value)}
                    placeholder="www.endoverdose.ca"
                  />
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_address">Address</Label>
                  <Input
                    id="contact_address"
                    value={labelSettings.contact_address}
                    onChange={(e) => updateField("contact_address", e.target.value)}
                    placeholder="3426 Lake Shore Blvd W"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Phone Number</Label>
                  <Input
                    id="contact_phone"
                    value={labelSettings.contact_phone}
                    onChange={(e) => updateField("contact_phone", e.target.value)}
                    placeholder="(844) 722-8829"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Email</Label>
                  <Input
                    id="contact_email"
                    value={labelSettings.contact_email}
                    onChange={(e) => updateField("contact_email", e.target.value)}
                    placeholder="info@tscp.ca"
                  />
                </div>
              </TabsContent>
            </Tabs>
          )}

          <div className="mt-6 pt-4 border-t border-border">
            <Button onClick={saveLabelSettings} disabled={isSaving || isLoading} className="w-full gap-2">
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Label Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <AdminLayout title="Settings" showBackButton={isMobile}>
      <div className={isMobile ? "p-4 pb-24" : "p-6 lg:p-8 max-w-4xl"}>
        {!isMobile && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">Settings</h2>
            <p className="text-muted-foreground">Manage your admin configuration</p>
          </div>
        )}
        <SettingsContent />
      </div>
    </AdminLayout>
  );
}
