import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PackageLabelSettings {
  from_company: string;
  from_tagline: string;
  from_website: string;
  contact_address: string;
  contact_phone: string;
  contact_email: string;
}

const defaultLabelSettings: PackageLabelSettings = {
  from_company: "MedXpress",
  from_tagline: "Healthcare Delivery Service",
  from_website: "www.medxpress.ca",
  contact_address: "3426 Lake Shore Blvd W",
  contact_phone: "(844) 722-8829",
  contact_email: "info@medxpress.ca",
};

export function useLabelSettings() {
  const [settings, setSettings] = useState<PackageLabelSettings>(defaultLabelSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("admin_settings")
          .select("setting_value")
          .eq("setting_key", "package_label")
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error fetching label settings:", error);
          return;
        }

        if (data?.setting_value) {
          setSettings(data.setting_value as unknown as PackageLabelSettings);
        }
      } catch (error) {
        console.error("Error fetching label settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, isLoading };
}
