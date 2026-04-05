import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/lib/supabase';
import { Upload, Plus } from 'lucide-react';
import type { Aircraft } from '@/types/database';

export default function NewTripPage() {
  const { profile, user } = useAuthContext();
  const navigate = useNavigate();
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<string>('');
  const [tripNumber, setTripNumber] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.operator_id) loadAircraft();
  }, [profile]);

  async function loadAircraft() {
    const { data } = await supabase
      .from('aircraft')
      .select('*')
      .eq('operator_id', profile!.operator_id!)
      .order('tail_number');
    if (data) setAircraft(data as Aircraft[]);
    setLoading(false);
  }

  async function handleCreateTrip(withUpload: boolean) {
    if (!selectedAircraft || !profile?.operator_id || !user) return;

    const number = tripNumber || `T${Date.now().toString(36).toUpperCase()}`;

    const { data: trip, error } = await supabase
      .from('trips')
      .insert({
        operator_id: profile.operator_id,
        aircraft_id: selectedAircraft,
        trip_number: number,
        status: 'draft',
        current_fuel_on_board: 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !trip) {
      alert(error?.message || 'Failed to create trip');
      return;
    }

    if (withUpload) {
      navigate(`/trips/${trip.id}/upload`);
    } else {
      // Create a blank first leg
      await supabase.from('trip_legs').insert({
        trip_id: trip.id,
        leg_number: 1,
        departure_icao: '',
        destination_icao: '',
        fuel_price_tiers: [{ price_per_gallon: 0, min_quantity_gallons: 0 }],
      });
      navigate(`/trips/${trip.id}/legs`);
    }
  }

  async function handleFileUpload(file: File) {
    if (!selectedAircraft || !user || !profile?.operator_id) return;
    setUploading(true);

    const number = tripNumber || `T${Date.now().toString(36).toUpperCase()}`;

    // Create trip
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .insert({
        operator_id: profile.operator_id,
        aircraft_id: selectedAircraft,
        trip_number: number,
        status: 'draft',
        current_fuel_on_board: 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (tripErr || !trip) {
      alert(tripErr?.message || 'Failed to create trip');
      setUploading(false);
      return;
    }

    // Upload file to storage
    const filePath = `${profile.operator_id}/${trip.id}/${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from('trip-uploads')
      .upload(filePath, file);

    if (uploadErr) {
      alert('File upload failed: ' + uploadErr.message);
      setUploading(false);
      return;
    }

    // Record upload
    await supabase.from('trip_uploads').insert({
      trip_id: trip.id,
      uploaded_by: user.id,
      file_name: file.name,
      file_path: filePath,
    });

    setUploading(false);
    // Navigate to legs page — algorithm will parse and populate later
    navigate(`/trips/${trip.id}/legs`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-skyiq-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Plan a Trip</h1>

      <div className="space-y-4">
        {/* Select aircraft */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Aircraft
          </label>
          <select
            value={selectedAircraft}
            onChange={(e) => setSelectedAircraft(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-skyiq-accent focus:bg-white"
          >
            <option value="">Select an aircraft</option>
            {aircraft.map((ac) => (
              <option key={ac.id} value={ac.id}>
                {ac.nickname || ac.tail_number}
              </option>
            ))}
          </select>
        </div>

        {/* Trip number (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trip Number (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. VMMIJF"
            value={tripNumber}
            onChange={(e) => setTripNumber(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-skyiq-accent focus:bg-white"
          />
        </div>
      </div>

      {selectedAircraft && (
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">How would you like to add legs?</h2>

          {/* Upload itinerary */}
          <label className="flex items-center gap-4 p-5 bg-white border-2 border-gray-200 rounded-xl hover:border-skyiq-accent cursor-pointer transition-colors">
            <Upload className="w-8 h-8 text-skyiq-accent shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Upload Itinerary</h3>
              <p className="text-sm text-gray-500">Upload your trip sheet PDF and we'll extract the details</p>
            </div>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              disabled={uploading}
            />
          </label>

          {uploading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-skyiq-accent" />
              Uploading and processing...
            </div>
          )}

          {/* Manual entry */}
          <button
            onClick={() => handleCreateTrip(false)}
            className="flex items-center gap-4 w-full p-5 bg-white border-2 border-gray-200 rounded-xl hover:border-skyiq-accent transition-colors text-left"
          >
            <Plus className="w-8 h-8 text-gray-400 shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900">No Itinerary</h3>
              <p className="text-sm text-gray-500">Add a blank leg and fill out all the details manually</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
