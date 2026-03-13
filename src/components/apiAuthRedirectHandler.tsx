// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import { useEffect } from 'react';

function isApiRequest(input: URL): boolean {
    return input.pathname.startsWith('/api/');
}

export default function ApiAuthRedirectHandler() {
    useEffect(() => {
        const store = globalThis as unknown as {
            __tapinFetchWrapped?: boolean;
        };

        if (store.__tapinFetchWrapped) {
            return;
        }

        const originalFetch = globalThis.fetch.bind(globalThis);

        globalThis.fetch = (async (...arguments_: Parameters<typeof fetch>) => {
            const response = await originalFetch(...arguments_);

            try {
                const request = arguments_[0];
                const requestUrl = request instanceof Request
                    ? new URL(request.url, globalThis.location.origin)
                    : new URL(String(request), globalThis.location.origin);

                if (isApiRequest(requestUrl)) {
                    if (response.status === 401 && globalThis.location.pathname !== '/login') {
                        globalThis.location.assign('/login');
                    }

                    if (response.status === 403 && globalThis.location.pathname !== '/mypage') {
                        globalThis.location.assign('/mypage');
                    }
                }
            } catch (e) {
                console.error('Failed to handle auth redirect for API response', e);
            }

            return response;
        }) as typeof fetch;

        store.__tapinFetchWrapped = true;
    }, []);

    return null;
}
