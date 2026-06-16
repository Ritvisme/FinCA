// ...existing code...
//This file is a single axios "client" the rest of your app will import instead of touching axios directly
// , and it's solving one specific problem: keeping the user logged in without making them re-login every time
//  their access token expires.





import axios from "axios";

const api = axios.create({//axios is the library we are using to make HTTP requests, and we are creating a 
// new instance of it with some default settings
    baseURL: "http://localhost:8000/api",
    withCredentials: true,
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;//this is the request that failed, we will save it and retry it after we get a new access token
        if (error.response?.status === 401 && !originalRequest._retry) {//if we get a 401(unauthorized) error and we haven't already tried to refresh the token
            originalRequest._retry = true;//mark the request as having been retried, so we don't get into an infinite loop 
            try {
                await axios.post("http://localhost:8000/api/refresh", {}, {
                    withCredentials: true,
                });
               const newToken=res.data.access_token;
               localStorage.setItem("access_token",newToken);//local storage is just a simple way to store the access token on the client side, you can also use cookies or any other storage mechanism
               originalRequest.headers["Authorization"]=`Bearer ${newToken}`;//update the original request with the new access token
               return api(originalRequest);
            }
            catch(refereshError){//if the refresh request fails, it means the refresh token is also invalid,
            //  so we need to log the user out

localStorage.removeItem("access_token");
window.location
return Promise.reject(refereshError);
            }
            }
            return Promise.reject(error);
    }
);

export default api;