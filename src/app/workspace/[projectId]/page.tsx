'use client';

import { useParams } from 'next/navigation';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

export default function WorkspaceProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  return <WorkspaceLayout projectId={projectId} />;
}
