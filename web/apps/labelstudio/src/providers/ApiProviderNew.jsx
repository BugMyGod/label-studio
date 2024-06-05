import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ErrorWrapper } from "../components/Error/Error";
import { modal } from "../components/Modal/Modal";
import { API_CONFIG_NEW } from "../config/ApiConfigNew";
import { APIProxy } from "../utils/api-proxy";
import { absoluteURL } from "../utils/helpers";

const API = new APIProxy(API_CONFIG_NEW);

export const ApiContextNew = createContext();
ApiContextNew.displayName = "ApiContextNew";

let apiLocked = false;

const errorFormatter = (result) => {
  const { response } = result;
  const isShutdown = String(response?.detail ?? result?.error) === "Failed to fetch";

  return {
    isShutdown,
    title: result.error ? "Runtime error" : "Server error",
    message: response?.detail ?? result?.error,
    stacktrace: response?.exc_info ?? null,
    version: response?.version,
    validation: Object.entries(response?.validation_errors ?? {}),
  };
};

const handleError = async (response, showModal = true) => {
  let result = response;

  if (result instanceof Response) {
    result = await API.generateError(response);
  }

  if (response.status === 401) {
    location.href = absoluteURL("/");
    return;
  }

  const { isShutdown, ...formattedError } = errorFormatter(result);

  if (showModal) {
    modal({
      allowClose: !isShutdown,
      body: isShutdown ? (
        <ErrorWrapper
          possum={false}
          title={"Connection refused"}
          message={"Server not responding. Is it still running?"}
        />
      ) : (
        <ErrorWrapper {...formattedError} />
      ),
      simple: true,
      style: { width: 680 },
    });
  }

  return isShutdown;
};

export const ApiProviderNew = forwardRef(({ children }, ref) => {
  const [error, setError] = useState(null);

  const callApi = useCallback(async (method, { params = {}, errorFilter, ...rest } = {}) => {
    if (apiLocked) return;

    setError(null);

    const result = await API[method](params, rest);

    if (result.status === 401) {
      apiLocked = true;
      location.href = absoluteURL("/");
      return;
    }

    if (result.error) {
      const shouldCatchError = errorFilter?.(result) === false;

      if (!errorFilter || shouldCatchError) {
        setError(result);
        const isShutdown = await handleError(result, contextValue.showModal);

        apiLocked = apiLocked || isShutdown;

        return null;
      }
    }

    return result;
  }, []);

  const contextValue = useMemo(
    () => ({
      apiNew: API,
      callApi,
      handleError,
      error,
      showModal: true,
      errorFormatter,
      isValidMethod(...args) {
        return API.isValidMethod(...args);
      },
    }),
    [error],
  );

  useEffect(() => {
    if (ref) {
      ref.current = contextValue;
    }
  }, [ref]);

  return <ApiContextNew.Provider value={contextValue}>{children}</ApiContextNew.Provider>;
});

export const useAPINew = () => {
  return useContext(ApiContextNew);
};
