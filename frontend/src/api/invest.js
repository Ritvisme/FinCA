import api from "./axios";

export const getHoldings = (asset_type) =>
  api.get("/invest/holdings", { params: { asset_type } });

export const createHolding = (data) =>
  api.post("/invest/holdings", data);

export const updateHolding = (id, data) =>
  api.put(`/invest/holdings/${id}`, data);

export const deleteHolding = (id) =>
  api.delete(`/invest/holdings/${id}`);

export const getGoals = () => api.get("/invest/goals");

export const createGoal = (data) => api.post("/invest/goals", data);

export const updateGoal = (id, data) =>
  api.put(`/invest/goals/${id}`, data);

export const deleteGoal = (id) => api.delete(`/invest/goals/${id}`);

export const getSips = (active_only = true) =>
  api.get("/invest/sips", { params: { active_only } });

export const createSip = (data) => api.post("/invest/sips", data);

export const cancelSip = (id) => api.post(`/invest/sips/${id}/cancel`);

export const getPortfolio = () => api.get("/invest/portfolio");
