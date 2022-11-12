import { PassThrough } from "stream";
import path from "path";
import fs from "fs";
import type { EntryContext, HandleDataRequestFunction } from "@remix-run/node";
import { Response } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import isbot from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { getFlyReplayResponse, getInstanceInfo } from "./utils.server";
import { getSession, sessionStorage } from "./session.server";
import invariant from "tiny-invariant";

const ABORT_DELAY = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const { currentInstance, primaryInstance } = await getInstanceInfo();

  responseHeaders.set("fly-region", process.env.FLY_REGION ?? "unknown");
  responseHeaders.set("fly-app", process.env.FLY_APP_NAME ?? "unknown");
  responseHeaders.set("fly-primary-instance", primaryInstance);
  responseHeaders.set("fly-instance", currentInstance);

  const maybeResponse = await handleTXID(request, responseHeaders);
  if (maybeResponse) return maybeResponse;
  const callbackName = isbot(request.headers.get("user-agent"))
    ? "onAllReady"
    : "onShellReady";

  return new Promise((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        [callbackName]: () => {
          const body = new PassThrough();

          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(body, {
              headers: responseHeaders,
              status: didError ? 500 : responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError: (err: unknown) => {
          reject(err);
        },
        onError: (error: unknown) => {
          didError = true;

          console.error(error);
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

export async function handleDataRequest(
  response: Response,
  { request }: Parameters<HandleDataRequestFunction>[1]
) {
  const { currentInstance, primaryInstance } = await getInstanceInfo();
  response.headers.set("fly-region", process.env.FLY_REGION ?? "unknown");
  response.headers.set("fly-app", process.env.FLY_APP_NAME ?? "unknown");
  response.headers.set("fly-primary-instance", primaryInstance);
  response.headers.set("fly-instance", currentInstance);
  const maybeResponse = await handleTXID(request, response.headers);
  if (maybeResponse) return maybeResponse;
  return response;
}

async function handleTXID(request: Request, responseHeaders: Headers) {
  const { primaryInstance, currentIsPrimary } = await getInstanceInfo();

  console.log("handleTXID", {
    primaryInstance,
    currentIsPrimary,
    requestMethod: request.method,
  });
  if (process.env.FLY) {
    const session = await getSession(request);
    if (request.method === "GET" || request.method === "HEAD") {
      const sessionTXID = session.get("txid");
      console.log({ sessionTXID });
      if (sessionTXID) {
        if (currentIsPrimary) {
          console.log("currentIsPrimary. Unsetting txid");
          session.unset("txid");
          responseHeaders.append(
            "Set-Cookie",
            await sessionStorage.commitSession(session)
          );
        } else {
          const txid = await getTXID();
          if (!txid) {
            console.log("UNEXPECTED: no txid found in sqlite.db-pos", { txid });
            return;
          }
          const localTXNumber = parseInt(txid, 16);
          const sessionTXNumber = parseInt(sessionTXID, 16);
          console.log("Comparing localTXNumber to sessionTXNumber", {
            localTXNumber,
            sessionTXNumber,
          });
          if (sessionTXNumber > localTXNumber) {
            console.log(
              "Local TXID is behind session TXID, redirecting to primary instance"
            );
            return await getFlyReplayResponse(primaryInstance);
          } else {
            console.log(
              "Local TXID is ahead of session TXID, clearing session TXID"
            );
            session.unset("txid");
            responseHeaders.append(
              "Set-Cookie",
              await sessionStorage.commitSession(session)
            );
          }
        }
      }
    } else if (request.method === "POST") {
      if (currentIsPrimary) {
        const { FLY_LITEFS_DIR } = process.env;
        invariant(FLY_LITEFS_DIR, "FLY_LITEFS_DIR is not defined");
        const txid = await getTXID();
        if (!txid) {
          console.log("UNEXPECTED: no txid found in sqlite.db-pos", { txid });
          return;
        }
        console.log("Setting txid", txid);
        session.set("txid", txid);
        responseHeaders.append(
          "Set-Cookie",
          await sessionStorage.commitSession(session)
        );
      } else {
        console.log("POST request sent to non-primary instance.");
      }
    } else {
      return new Response(null, { status: 405 });
    }
  }
}

async function getTXID() {
  const { FLY_LITEFS_DIR } = process.env;
  invariant(FLY_LITEFS_DIR, "FLY_LITEFS_DIR is not defined");
  const dbPos = await fs.promises
    .readFile(path.join(FLY_LITEFS_DIR, `sqlite.db-pos`), "utf-8")
    .catch(() => "0");
  return dbPos.trim().split("/")[0];
}
