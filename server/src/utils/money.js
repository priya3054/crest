// Round to 2 decimal places (paise). Used everywhere money or prices are computed
// so rounding behaviour is identical across the market sim, trades, and the API.
// Was copy-pasted in three files; centralised here.
export const round2 = (n) => Math.round(n * 100) / 100;
