// Twilio room SIDs are "RM" + 32 alphanumeric chars. Validating the shape also
// sanitizes the value before it is used as a Firestore document id.
export const ROOM_SID_PATTERN = /^RM[a-zA-Z0-9]{32}$/;
