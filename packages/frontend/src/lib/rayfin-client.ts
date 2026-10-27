//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
  ConnectorsRayfinClient,
  resolveRayfinConfig,
} from '@microsoft/rayfin-client';
import { fabricSemanticModel } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import type { UniversalAppSchema } from '@rayfin-app/shared';

import {
  type VerkoopSchema,
  connectorConfig as verkoopConfig,
} from '../../../../rayfin/connectors/verkoop/schema';

/** Connectors keyed by their exact `rayfin.yml` name. */
export type AppConnectorsSchema = {
  verkoop: VerkoopSchema;
};

export type AppClient = ConnectorsRayfinClient<
  UniversalAppSchema,
  Record<string, never>,
  AppConnectorsSchema
>;

let _client: Promise<AppClient> | undefined;

export class MissingRayfinConfigError extends Error {
  constructor(readonly missing: readonly string[]) {
    super(`Missing required Rayfin configuration: ${missing.join(', ')}`);
    this.name = 'MissingRayfinConfigError';
  }
}

/**
 * Resolves and shares the app's configured Rayfin client.
 *
 * Typed by `UniversalAppSchema`, so `client.data.<Entity>` is checked against
 * the entities declared by `@rayfin-app/data`. Without the generic the
 * data API is `any`, and a typo in an entity or field name only surfaces at
 * runtime — which the app's `tsc --noCheck` build would never catch.
 *
 * Async because deployment-specific values are resolved at runtime rather than
 * compiled in: a Deployment Pipeline promotes one built artifact from Dev to
 * Prod, so a bundle carrying build-time `VITE_*` values would point the
 * promoted app at the previous stage's backend. The `VITE_*` values are still
 * passed as defaults, which is what local dev runs on.
 */
export async function getRayfinClient(): Promise<AppClient> {
  if (!_client) {
    _client = createClient().catch((error) => {
      _client = undefined;
      throw error;
    });
  }

  return _client;
}

async function createClient(): Promise<AppClient> {
  const resolved = await resolveRayfinConfig({
    apiUrl: import.meta.env.VITE_RAYFIN_API_URL,
    publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
    workspaceId: import.meta.env.VITE_FABRIC_WORKSPACE_ID,
    itemId: import.meta.env.VITE_FABRIC_ITEM_ID,
    portalUrl: import.meta.env.VITE_FABRIC_PORTAL_URL,
  });

  if (!resolved.baseUrl || !resolved.publishableKey) {
    throw new MissingRayfinConfigError([
      ...(!resolved.baseUrl ? ['apiUrl'] : []),
      ...(!resolved.publishableKey ? ['publishableKey'] : []),
    ]);
  }

  // The second argument is the connector runtime map: fabricSemanticModel()
  // decodes the query response, without it executeQuery cannot be read.
  return new ConnectorsRayfinClient<
    UniversalAppSchema,
    Record<string, never>,
    AppConnectorsSchema
  >(
    {
      baseUrl: resolved.baseUrl,
      publishableKey: resolved.publishableKey,
      authStorage: true,
      runtimeConfig: resolved.runtimeConfig,
      connectors: { verkoop: verkoopConfig },
    },
    { verkoop: fabricSemanticModel() }
  );
}
