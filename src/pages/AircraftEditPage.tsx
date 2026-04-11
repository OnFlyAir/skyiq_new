// AircraftEditPage — Edit an existing aircraft's specifications.
// Route: /fleet/:id/edit
// Loads aircraft from Supabase, provides an editable form matching AddAircraftPage fields,
// and saves updates back to the database.

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AircraftForm {
  tail_number: string;
  manufacturer: string;
  type: string;
  basic_empty_weight: number;
  max_takeoff_weight: number;
  max_landing_weight: number;
  max_ramp_weight: number;
  preferred_reserve: number;
  max_fuel_capacity: number;
  taxi_fuel_burn: number;
  default_pax_weight: number;
  default_baggage_with_pax: number;
  default_baggage_no_pax: number;
  default_pic_weight: number;
  default_sic_weight: number;
  default_cabin_weight: number;
  penalty_rate: number;
  cruise_fuel_burn: number;
  carry_type_id: number | null;
}

const fields: { key: keyof AircraftForm; label: string; type: "text" | "number"; tooltip?: string }[] = [
  { key: "tail_number", label: "Tail Number", type: "text" },
  { key: "manufacturer", label: "Manufacturer", type: "text" },
  { key: "type", label: "Model / Type", type: "text" },
  { key: "basic_empty_weight", label: "Basic Empty Weight (lbs)", type: "number", tooltip: "Aircraft weight without fuel, crew, or passengers" },
  { key: "max_takeoff_weight", label: "Max Takeoff Weight (lbs)", type: "number" },
  { key: "max_landing_weight", label: "Max Landing Weight (lbs)", type: "number" },
  { key: "max_ramp_weight", label: "Max Ramp Weight (lbs)", type: "number" },
  { key: "preferred_reserve", label: "Preferred Reserve (lbs)", type: "number", tooltip: "Minimum fuel you want to land with" },
  { key: "max_fuel_capacity", label: "Max Fuel Capacity (lbs)", type: "number" },
  { key: "taxi_fuel_burn", label: "Taxi Fuel Burn (lbs)", type: "number" },
  { key: "default_pax_weight", label: "Default PAX Weight (lbs)", type: "number", tooltip: "Used when passenger weight is not specified on the itinerary" },
  { key: "default_baggage_with_pax", label: "Baggage Weight with PAX (lbs)", type: "number" },
  { key: "default_baggage_no_pax", label: "Baggage Weight without PAX (lbs)", type: "number" },
  { key: "default_pic_weight", label: "Default PIC Weight (lbs)", type: "number" },
  { key: "default_sic_weight", label: "Default SIC Weight (lbs)", type: "number" },
  { key: "default_cabin_weight", label: "Cabin Attendant Weight (lbs)", type: "number" },
  { key: "cruise_fuel_burn", label: "Cruise Fuel Burn (lbs/hour)", type: "number" },
  { key: "penalty_rate", label: "Penalty Rate ($/lb)", type: "number", tooltip: "Cost penalty for carrying excess fuel weight" },
];

export default function AircraftEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<AircraftForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadAircraft() {
      if (!id) return;
      const { data, error } = await supabase
        .from("aircrafts")
        .select("*")
        .eq("id", parseInt(id))
        .single();

      if (error || !data) {
        toast({ title: "Error", description: "Aircraft not found", variant: "destructive" });
        navigate("/fleet");
        return;
      }

      setForm({
        tail_number: data.tail_number ?? "",
        manufacturer: data.manufacturer ?? "",
        type: data.type ?? "",
        basic_empty_weight: data.basic_empty_weight ?? 0,
        max_takeoff_weight: data.max_takeoff_weight ?? 0,
        max_landing_weight: data.max_landing_weight ?? 0,
        max_ramp_weight: data.max_ramp_weight ?? 0,
        preferred_reserve: data.preferred_reserve ?? 0,
        max_fuel_capacity: data.max_fuel_capacity ?? 0,
        taxi_fuel_burn: data.taxi_fuel_burn ?? 0,
        default_pax_weight: data.default_pax_weight ?? 0,
        default_baggage_with_pax: data.default_baggage_with_pax ?? 0,
        default_baggage_no_pax: data.default_baggage_no_pax ?? 0,
        default_pic_weight: data.default_pic_weight ?? 0,
        default_sic_weight: data.default_sic_weight ?? 0,
        default_cabin_weight: data.default_cabin_weight ?? 0,
        penalty_rate: data.penalty_rate ?? 0,
        cruise_fuel_burn: data.cruise_fuel_burn ?? 0,
        carry_type_id: data.carry_type_id ?? null,
      });
      setLoading(false);
    }
    loadAircraft();
  }, [id]);

  const handleChange = (key: keyof AircraftForm, value: string) => {
    if (!form) return;
    const field = fields.find((f) => f.key === key);
    setForm({
      ...form,
      [key]: field?.type === "number" ? parseFloat(value) || 0 : value,
    });
  };

  const handleSave = async () => {
    if (!form || !id) return;
    setSaving(true);

    const { error } = await supabase
      .from("aircrafts")
      .update(form)
      .eq("id", parseInt(id));

    setSaving(false);

    if (error) {
      toast({ title: "Error", description: "Failed to save aircraft", variant: "destructive" });
      return;
    }

    toast({ title: "Saved", description: `${form.tail_number} updated successfully` });
  };

  const handleDelete = async () => {
    if (!id) return;
    const { error } = await supabase
      .from("aircrafts")
      .update({ is_enabled: false })
      .eq("id", parseInt(id));

    if (error) {
      toast({ title: "Error", description: "Failed to delete aircraft", variant: "destructive" });
      return;
    }

    toast({ title: "Deleted", description: "Aircraft removed from fleet" });
    navigate("/fleet");
  };

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/fleet")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Edit {form.tail_number}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Aircraft Specifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(({ key, label, type, tooltip }) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={key} className="text-sm flex items-center gap-1">
                  {label}
                  {tooltip && (
                    <span className="text-muted-foreground text-xs" title={tooltip}>
                      &#9432;
                    </span>
                  )}
                </Label>
                <Input
                  id={key}
                  type={type}
                  value={form[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  step={type === "number" ? "any" : undefined}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-[#1a3a5c] hover:bg-[#2563eb]"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Aircraft
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {form.tail_number}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the aircraft from your fleet. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
