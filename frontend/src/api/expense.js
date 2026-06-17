import api from "./axios";

export const getTransactions = (start_date, end_date, category) =>
  api.get("/expense/transactions", { params: { start_date, end_date, category } });

export const createTransaction = (data) =>
  api.post("/expense/transactions", data);

export const updateTransaction = (id, data) =>
  api.put(`/expense/transactions/${id}`, data);

export const deleteTransaction = (id) =>
  api.delete(`/expense/transactions/${id}`);

export const getBudgets = () =>
  api.get("/expense/budgets");

export const setBudget = (data) =>
  api.post("/expense/budgets", data);

export const getMonthlySummary = (month) =>
  api.get(`/expense/summary/${month}`);
