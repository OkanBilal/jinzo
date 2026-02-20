import { SVGProps } from "react"

const StatusInProgress = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16" fill="none" {...props}>
    <circle cx={8} cy={8} r={6.5} stroke="currentColor" strokeWidth={1.5} />
    <path d="M8 1.5A6.5 6.5 0 0 0 8 14.5V1.5Z" fill="currentColor" />
  </svg>
)

export default StatusInProgress
