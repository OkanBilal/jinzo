import { SVGProps, ReactElement } from "react";
import type { WorkspaceStatus } from "@/lib/redux/api/workspacesApi";

interface WorkspaceStatusIconProps extends SVGProps<SVGSVGElement> {
  status: WorkspaceStatus;
}

/** Backlog — dashed circle */
const BacklogIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16" fill="none" {...props}>
    <circle cx={8} cy={8} r={6.5} stroke="currentColor" strokeWidth={1.5} strokeDasharray="3 2.5" />
  </svg>
);

/** Todo — empty circle */
const TodoIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16" fill="none" {...props}>
    <circle cx={8} cy={8} r={6.5} stroke="currentColor" strokeWidth={1.5} />
  </svg>
);

/** In Progress — half-filled circle */
const InProgressIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16" fill="none" {...props}>
    <circle cx={8} cy={8} r={6.5} stroke="currentColor" strokeWidth={1.5} />
    <path d="M8 1.5A6.5 6.5 0 0 0 8 14.5V1.5Z" fill="currentColor" />
  </svg>
);

/** In Review — three-quarter filled circle */
const InReviewIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16" fill="none" {...props}>
    <circle cx={8} cy={8} r={6.5} stroke="currentColor" strokeWidth={1.5} />
    <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8 6.5 6.5 0 0 1 8 14.5 6.5 6.5 0 0 1 1.5 8V1.5H8Z" fill="currentColor" fillRule="evenodd" />
  </svg>
);

/** Done — filled circle with checkmark */
const DoneIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16" fill="none" {...props}>
    <circle cx={8} cy={8} r={7} fill="currentColor" />
    <path d="M5.5 8.5L7 10l3.5-4" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Canceled — circle with X */
const CanceledIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16" fill="none" {...props}>
    <circle cx={8} cy={8} r={7} fill="currentColor" />
    <path d="M5.75 5.75l4.5 4.5M10.25 5.75l-4.5 4.5" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

/** Duplicate — circle with X (muted) */
const DuplicateIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16" fill="none" {...props}>
    <circle cx={8} cy={8} r={7} fill="currentColor" />
    <path d="M5.75 5.75l4.5 4.5M10.25 5.75l-4.5 4.5" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const statusIcons: Record<WorkspaceStatus, (props: SVGProps<SVGSVGElement>) => ReactElement> = {
  backlog: BacklogIcon,
  todo: TodoIcon,
  in_progress: InProgressIcon,
  in_review: InReviewIcon,
  done: DoneIcon,
  canceled: CanceledIcon,
  duplicate: DuplicateIcon,
};

export default function WorkspaceStatusIcon({ status, ...props }: WorkspaceStatusIconProps) {
  const Icon = statusIcons[status] ?? statusIcons.todo;
  return <Icon {...props} />;
}
