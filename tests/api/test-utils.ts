import { NextRequest } from "next/server"

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1]

export const makeNextRequest = (url: string, init?: NextRequestInit) =>
  new NextRequest(url, init)

export const readJson = async <T>(response: Response) =>
  (await response.json()) as T

export const makeFormDataRequest = (
  url: string,
  formData: FormData,
  init?: RequestInit
) =>
  new Request(url, {
    method: "POST",
    body: formData,
    ...init
  })
