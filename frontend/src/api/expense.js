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

export const importPreview = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/expense/import/preview", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const importCommit = (transactions) =>
  api.post("/expense/import/commit", { transactions });
