'use client';

import React, { Suspense } from 'react';
import RequestBookingClient from './RequestBookingClient';

export const dynamic = 'force-dynamic';

export default function RequestBookingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RequestBookingClient />
    </Suspense>
  );
}
