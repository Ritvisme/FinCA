import api from "./axios";

export const listUsers = () => api.get("/admin/users");
export const getStats = () => api.get("/admin/stats");
