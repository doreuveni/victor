// Shared aspect ratios for the uniform grid system (see design notes in the
// Home/Profile grids). COVER_ASPECT is also the target the cover-photo
// cropper crops to, so what a user frames at upload time is what the
// discover grid actually shows — everywhere else derives via object-cover.
export const COVER_ASPECT = 3 / 4; // portrait — discover grid ("גלה")
export const SQUARE_ASPECT = 1; // profile + board grids
