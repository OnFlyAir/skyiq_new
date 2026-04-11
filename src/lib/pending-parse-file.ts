// Holds a File reference between NewTripPage → TripLegsPage navigation.
// React Router state serialises objects, so File instances can't survive the trip.
export const pendingParseFile: { current: File | null } = { current: null };
