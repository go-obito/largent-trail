import createClient from "openapi-fetch";
import type { paths } from "./schema";

type TokenGetter = (options?: { skipCache?: boolean }) => Promise<string | null>;

type ProblemDetails = {
  code: string | null;
  title: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly title: string;

  constructor(status: number, code: string | null, title: string) {
    super(title);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.title = title;
  }
}

function problemDetails(value: unknown, response: Response): ProblemDetails {
  return {
    code:
      typeof value === "object" &&
      value !== null &&
      "code" in value &&
      typeof value.code === "string"
        ? value.code
        : null,
    title:
      typeof value === "object" &&
      value !== null &&
      "title" in value &&
      typeof value.title === "string"
        ? value.title
        : response.statusText || `Request failed (${response.status})`,
  };
}

async function apiErrorFromResponse(
  response: Response,
): Promise<ApiError | null> {
  if (
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/problem+json")
  ) {
    return null;
  }

  let details: ProblemDetails;
  try {
    details = problemDetails(await response.clone().json(), response);
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    details = problemDetails(null, response);
  }

  return new ApiError(response.status, details.code, details.title);
}

function authenticatedFetch(
  getToken: TokenGetter,
  redirectToSignIn: () => void | Promise<unknown>,
): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);

    const send = async (token: string | null) => {
      const headers = new Headers(request.headers);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      } else {
        headers.delete("Authorization");
      }

      return fetch(new Request(request, { headers }));
    };

    let token = await getToken();
    let response = await send(token);
    let apiError = response.status === 401
      ? await apiErrorFromResponse(response)
      : null;

    if (response.status === 401 && apiError?.code === "token_expired") {
      token = await getToken({ skipCache: true });
      response = await send(token);
      apiError = response.status === 401
        ? await apiErrorFromResponse(response)
        : null;
    }

    if (response.status === 401 && !token) {
      await redirectToSignIn();
    }

    apiError ??= await apiErrorFromResponse(response);
    if (apiError) {
      throw apiError;
    }

    return response;
  };
}

export function createApiClient(
  getToken: TokenGetter,
  redirectToSignIn: () => void | Promise<unknown>,
) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be configured.");
  }

  return createClient<paths>({
    baseUrl,
    fetch: authenticatedFetch(getToken, redirectToSignIn),
  });
}
