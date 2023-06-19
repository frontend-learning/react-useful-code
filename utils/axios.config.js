import axios from 'axios';

export const STORAGE_KEY = {
  ACCESS_TOKEN: 'ACCESS_TOKEN',
  REFRESH_TOKEN: 'REFRESH_TOKEN',
};

const API_STATUS = {
  UNAUTHORIZED: 401,
};

const config = {
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  validateStatus: (status) => status >= 200 && status < 400,
  timeout: 60000,
};

let isRefreshing = false;
let failedQueue = [];

// EX: Push callback to failedQueue for retry request
function addFailedQueue(cb) {
  failedQueue.push(cb);
}

function processFailedQueue(token) {
  failedQueue.map((cb) => cb(token));
  failedQueue = [];
}

function reloadApp() {
  localStorage.removeItem(STORAGE_KEY.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEY.REFRESH_TOKEN);

  isRefreshing = false;
  failedQueue = [];
  // force reload app, reset all state
  // window.location.replace(`${LOCATION.SIGN_IN}?redirect=${window.history.state.as}`);
}

const axiosClient = axios.create(config);

const createAuthToken = (token) => `Bearer ${token}`;

export function setAppAccessToken(token) {
  axiosClient.defaults.headers.Authorization = createAuthToken(token);
}

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const {
      config: originalRequest,
      response,
    } = error;

    // EX: Handle 401 error
    if (response?.status === API_STATUS.UNAUTHORIZED) {
      const accessToken = localStorage.getItem(STORAGE_KEY.ACCESS_TOKEN);
      const refreshToken = localStorage.getItem(STORAGE_KEY.REFRESH_TOKEN);

      // EX: Check if token is expired
      if (!refreshToken) {
        reloadApp();
        return Promise.reject(error);
      }

      // EX: Check if token is refreshing
      if (!isRefreshing) {
        isRefreshing = true;

        try {
          const refreshResponse = await axios({
            ...config,
            method: 'post',
            url: '/Auth/RefreshToken',
            data: { accessToken, refreshToken },
          });

          const newAccessToken = refreshResponse.data.data.accessToken;
          const newRefreshToken = refreshResponse.data.data.refreshToken;

          localStorage.setItem(STORAGE_KEY.ACCESS_TOKEN, newAccessToken);
          localStorage.setItem(STORAGE_KEY.REFRESH_TOKEN, newRefreshToken);

          isRefreshing = false;

          setAppAccessToken(newAccessToken);

          // EX: Add callback to failedQueue for retry request and process it
          return new Promise((resolve) => {
            addFailedQueue((newToken) => {
              originalRequest.headers.Authorization = createAuthToken(newToken);

              resolve(axiosClient(originalRequest));
            });

            processFailedQueue(newAccessToken);
          });
        } catch (_e) {
          reloadApp();
          return Promise.reject(error);
        }
      }

      // EX: ONLY add callback to failedQueue for retry request
      return new Promise((resolve) => {
        addFailedQueue((newToken) => {
          originalRequest.headers.Authorization = createAuthToken(newToken);

          resolve(axiosClient(originalRequest));
        });
      });
    }

    // EX: Handle other error
    return Promise.reject(error);
  },
);

export default axiosClient;
