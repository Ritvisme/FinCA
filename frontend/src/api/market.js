import api from "./axios";

// Live NSE stock screen for the Investments page ideas card.
export const getStockIdeas = () =>
  api.get("/market/ideas").then((r) => r.data);

export const getInvestorProfile = () =>
  api.get("/invest/profile").then((r) => r.data);

export const saveInvestorProfile = (profile) =>
  api.put("/invest/profile", profile).then((r) => r.data);
