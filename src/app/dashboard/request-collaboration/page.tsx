// app/dashboard/request-collaboration/page.js
import { Suspense } from 'react';
import RequestCollabClient from './RequestCollabClient';

export default function RequestCollabPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RequestCollabClient />
    </Suspense>
  );
}
